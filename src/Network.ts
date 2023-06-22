import { DataPacket_Kind, RemoteParticipant, Room, RoomEvent } from 'livekit-client';
import { Mob } from './Mob';
import { HUMAN_SKELETON } from './Skeletons';
import { getMapData, refreshSpriteTile, setMapData, setTile } from './Map';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const room = new Room();
let lastUpdate = Date.now();
let lastMapRequest = Date.now();
let lastHostUpdate = Date.now();
const UPDATE_INTERVAL_MS: number = 100;
const MAP_REQUEST_INTERVAL: number = 1000;
let connected = false;
let hostingServer = false;
let localMobs: Mob[] = [];
let localPlayer: Mob;
let hadMap: boolean = false;
let host: RemoteParticipant | undefined;
let removed: string[] = [];

export function updatePlayerList(mobs: Mob[]): void {
    const listDiv = document.getElementById("playerList")!;
    listDiv.innerHTML = "";

    for (const mob of mobs) {
        const div = document.createElement("div");
        div.innerHTML = mob.name;
        div.classList.add("nametag");
        listDiv.appendChild(div);
    }
}

export function networkConnected(): boolean {
    return (host !== undefined) || hostingServer;
}

export async function startNetwork(token: string, hosting: boolean) {
    hostingServer = hosting;
    const wsURL = "wss://talesofyore.livekit.cloud"

    await room.connect(wsURL, token);

    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        if (participant === host) {
            host = undefined;
            localMobs.splice(0, localMobs.length);
            localMobs.push(localPlayer);
        } else {
            const mob = localMobs.find(m => m.sid === participant.sid);
            if (mob) {
                localMobs.splice(localMobs.indexOf(mob), 1);
                removed.push(mob.id);
                const data = JSON.stringify({ type: "remove", mobId: mob.id });
                room.localParticipant.publishData(encoder.encode(data), DataPacket_Kind.RELIABLE);
                updatePlayerList(localMobs);
            } else {
                console.log("No Mob found for participant");
            }
        }
    });

    room.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
        const strData = decoder.decode(payload);
        const message = JSON.parse(strData);
        if (message.type === "requestMap" && hosting) {
            if (participant) {
                sendMapUpdate(participant.sid);
            }
        }
        if (message.type === "iAmHost" && !hosting) {
            host = participant!;
        }
        if (message.type === "mapData" && !hosting) {
            setMapData(message.data);    
            hadMap = true;
        }
        if (message.type === "tileChange") {
            setTile(message.x, message.y, message.tile);
            refreshSpriteTile(message.x, message.y);
            if (hostingServer) {
                sendNetworkTile(message.x, message.y, message.tile);
            }
        }
        if (message.type === "remove") {
            const mob = localMobs.find(mob => mob.id === message.mobId);
            if (mob) {
                removed.push(mob.id);
                localMobs.splice(localMobs.indexOf(mob), 1);
                updatePlayerList(localMobs);
            }
        }
        if (message.type === "mobs") {
            if (localMobs && localPlayer) {
                if (message.host) {
                    host = participant;
                }  
                for (const mobData of message.data) {
                    if (mobData.id !== localPlayer.id) {
                        if (removed.includes(mobData.id)) {
                            continue;
                        }

                        let targetMob = localMobs.find(mob => mob.id === mobData.id);
                        if (!targetMob) {
                            targetMob = new Mob(mobData.id, mobData.name, HUMAN_SKELETON, mobData.x, mobData.y);
                            localMobs.push(targetMob);
                            updatePlayerList(localMobs);
                        }

                        if (participant) {
                            targetMob.sid = participant.sid;
                        }
                        targetMob.updateFromNetworkState(mobData);
                    }
                }
            }
        }
    });

    console.log("Network started");
    connected = true;
}

export function sendMapUpdate(target: string) {
    const mapData = JSON.stringify({ type: "mapData", data: getMapData() });
    room.localParticipant.publishData(encoder.encode(mapData), DataPacket_Kind.RELIABLE, target ? [target] : undefined)
}

export function sendNetworkTile(x: number, y: number, tile: number) {
    if (hostingServer) {
        const data = JSON.stringify({ type: "tileChange", x, y, tile });
        room.localParticipant.publishData(encoder.encode(data), DataPacket_Kind.RELIABLE);
    } else if (host) {
        const data = JSON.stringify({ type: "tileChange", x, y, tile });
        room.localParticipant.publishData(encoder.encode(data), DataPacket_Kind.RELIABLE, [host.sid]);
    }
}

export function networkUpdate(player: Mob, players: Mob[]) {
    localPlayer = player;
    localMobs = players;

    if (!connected) {
        return;
    }

    if (Date.now() - lastMapRequest > MAP_REQUEST_INTERVAL && host) {
        lastMapRequest = Date.now();
        if (!hostingServer && !hadMap) {
            // request the map
            console.log("Requesting Map");
            const data = JSON.stringify({ type: "requestMap" });
            room.localParticipant.publishData(encoder.encode(data), DataPacket_Kind.RELIABLE, [host.sid]);
        }
    }

    // need to send out an "I am the host message"
    if (Date.now() - lastHostUpdate > MAP_REQUEST_INTERVAL && host) {
        lastHostUpdate = Date.now();
        const data = JSON.stringify({ type: "iAmHost" });
        room.localParticipant.publishData(encoder.encode(data), DataPacket_Kind.RELIABLE);
    }

    if (Date.now() - lastUpdate > UPDATE_INTERVAL_MS) {
        lastUpdate = Date.now();

        if (hostingServer) {
            const data = JSON.stringify({ type: "mobs", host: true, data: players.map(mob => mob.getNetworkState()) });
            room.localParticipant.publishData(encoder.encode(data), DataPacket_Kind.LOSSY);
        } else {
            if (host) {
                const data = JSON.stringify({ type: "mobs", host: false, data: [player.getNetworkState()] });
                room.localParticipant.publishData(encoder.encode(data), DataPacket_Kind.LOSSY, [host.sid]);
            }
        }
    }
}
