
import { MAP_WIDTH, SKY_HEIGHT, TILE_SIZE, getTile, refreshSpriteTile, refreshSpriteTileMap, renderMap, setTile, tiles } from "./Map";
import { INVENTORY, Mob } from "./Mob";
import { isMobile, isTablet } from "./MobileDetect";
import { networkConnected, networkUpdate, sendChatMessage, startNetwork, updatePlayerList } from "./Network";
import { addParticle, createDirtParticle, renderAndUpdateParticles } from "./Particles";
import { getSprite, resourcesLoaded } from "./Resources";
import { HUMAN_SKELETON } from "./Skeletons";
import { v4 as uuidv4 } from 'uuid';

let serverId = localStorage.getItem("server");
export let hosting = true;
let names = ["Beep", "Boop", "Pop", "Whizz", "Bang", "Snap", "Wooga", "Pow", "Zowie", "Smash", "Grab", "Kaboom"];
let waitingForHost = false;
const chatInput = document.getElementById("chatinput") as HTMLInputElement;

if (!serverId) {
    serverId = uuidv4();
    localStorage.setItem("server", serverId);
}

const params = new URLSearchParams(location.search);
if (params.get("server") && params.get("server") !== serverId) {
    hosting = false;
    (document.getElementById("serverId") as HTMLInputElement).value = params.get("server")!;
} else {
    console.log("Connect on: " + location.href + "?server="+serverId)
    document.getElementById("serverLink")!.innerHTML = location.href+"?server="+serverId;
}

let username = localStorage.getItem("username");
if (!username) {
    username = names[Math.floor(Math.random() * names.length)];
    localStorage.setItem("username", username);
}
(document.getElementById("playerName") as HTMLInputElement).value = username;

let SHOW_BOUNDS: boolean = false;
const ZOOM: number = 2;

let animTime = 0;
const canvas: HTMLCanvasElement = document.getElementById("game") as HTMLCanvasElement;
const g: CanvasRenderingContext2D = canvas.getContext("2d")!;
let tooltipShown = 0;

// Utilities

const keys: Record<string, boolean> = {};
const mouseButtons: Record<number, boolean> = {};
let mouseX = 0;
let mouseY = 0;
let lastWorkX = 0;
let lastWorkY = 0;
let mainAreaTouchId = 0;
let controllerTouchId = 0;
let frontPlace: boolean = true;
let connecting: boolean = false;
const tooltip = document.getElementById("tooltip") as HTMLDivElement

if (isMobile() || isTablet()) {
    document.getElementById("serverLink")!.style.display = "none";
};

export function showTip(tip: string) {
    tooltip.style.display = "block";
    tooltip.innerHTML = tip;
    tooltipShown = Date.now();
}

document.getElementById("startGame")!.addEventListener("click", () => {
    hosting = true;
    const request = new XMLHttpRequest();
    request.open("GET", "https://cokeandcode.com/demos/unearthed/room.php?username="+encodeURIComponent(username!)+"&room="+serverId, false);
    request.send();
    const accessToken = request.responseText;

    document.getElementById("connect")!.style.display = "none";
    startNetwork(accessToken, hosting);
    connecting = true;
    waitingForHost = true;
    document.getElementById("serverLink")!.innerHTML = location.href+"?server="+serverId;
});
document.getElementById("joinGame")!.addEventListener("click", () => {
    document.getElementById("connect")!.style.display = "none";
    document.getElementById("join")!.style.display = "block";
});
document.getElementById("setupButton")!.addEventListener("click", () => {
    document.getElementById("connect")!.style.display = "none";
    document.getElementById("setup")!.style.display = "block";
});
document.getElementById("doneButton")!.addEventListener("click", () => {
    username = (document.getElementById("playerName") as HTMLInputElement).value;
    player.name = username;
    localStorage.setItem("username", username);
    document.getElementById("connect")!.style.display = "block";
    document.getElementById("setup")!.style.display = "none";

    updatePlayerList(mobs);
});
document.getElementById("settings")!.addEventListener("click", () => {
    const panel = document.getElementById("settingsPanel")!;
    if (panel.style.display === "block") {
        panel.style.display = "none";
    } else {
        panel.style.display = "block";
    }
})
document.getElementById("chat")!.addEventListener("click", () => {
    if (networkConnected()) {
        if (chatInput.style.display === "block") {
            hideChat();
        } else {
            showChat();
        }
    }
})
document.getElementById("closeButton")!.addEventListener("click", () => {
    document.getElementById("settingsPanel")!.style.display = "none";
})

document.getElementById("joinButton")!.addEventListener("click", () => {
    hosting = false;
    serverId = (document.getElementById("serverId") as HTMLInputElement).value;
    username = (document.getElementById("playerName") as HTMLInputElement).value;
    player.name = username;
    updatePlayerList(mobs);

    const request = new XMLHttpRequest();
    request.open("GET", "https://cokeandcode.com/demos/unearthed/room.php?username="+encodeURIComponent(username!)+"&room="+serverId, false);
    request.send();
    const accessToken = request.responseText;

    document.getElementById("join")!.style.display = "none";
    startNetwork(accessToken, hosting);
    connecting = true;
    waitingForHost = true;
});

document.addEventListener("keyup", (event: KeyboardEvent) => {
    keys[event.key] = false;
});
chatInput!.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Escape") {
        chatInput.value = "";
        hideChat();
    }
    if (event.key === "Enter") {
        sendChat(chatInput.value);
        chatInput.value = "";
        hideChat();
    }
});

document.addEventListener("keydown", (event: KeyboardEvent) => {
    if (document.activeElement === chatInput) {
        return;
    }

    keys[event.key] = true;


    if (networkConnected()) {
        if (event.key === "Enter") {
            showChat();
        }
    }

    if (event.key === 'q') {
        let index = 0;
        if (player.itemHeld) {
            index = INVENTORY.indexOf(player.itemHeld) + 1;
            if (index >= INVENTORY.length) {
                index = 0;
            }
        }
        player.itemHeld = INVENTORY[index];
    }
    if (event.key === 'x') {
        frontPlace = !frontPlace;
    }

    if (event.key === 'e') {
        let index = 0;
        if (player.itemHeld) {
            index = INVENTORY.indexOf(player.itemHeld) - 1;
            if (index < 0) {
                index = INVENTORY.length-1;
            }
        }
        player.itemHeld = INVENTORY[index];
    }
    if (event.key === 'r') {
        if (confirm("Reset Map?") && hosting) {
            localStorage.removeItem("map");
            localStorage.removeItem("mapbg");
            location.reload();
        }
    }
});
canvas.addEventListener('contextmenu', event => event.preventDefault());

if (isMobile()) {
    canvas.addEventListener("touchmove", (event: TouchEvent) => {
        for (let i=0;i<event.changedTouches.length;i++) {
            const touch = event.changedTouches.item(i);
            if (touch) {
                mouseMove(touch.clientX * ZOOM, touch.clientY * ZOOM, touch.identifier);
            }
        }
        event.preventDefault();
    });

    canvas.addEventListener("touchstart", (event: TouchEvent) => {
        for (let i=0;i<event.changedTouches.length;i++) {
            const touch = event.changedTouches.item(i);
            if (touch) {
                mouseDown(touch.clientX * ZOOM,  touch.clientY * ZOOM, touch.identifier);
                mouseMove(touch.clientX * ZOOM, touch.clientY * ZOOM, touch.identifier);
            }
        }
        event.preventDefault();
    });

    canvas.addEventListener("touchend", (event: TouchEvent) => {
        for (let i=0;i<event.changedTouches.length;i++) {
            const touch = event.changedTouches.item(i);
            if (touch) {
                mouseUp(touch.clientX * ZOOM,  touch.clientY * ZOOM, touch.identifier);
            }
        }
        event.preventDefault();
    });
} else {
    canvas.addEventListener("mousemove", (event: MouseEvent) => {
        mouseMove(event.x * ZOOM, event.y * ZOOM, 1);
        event.preventDefault();
    });
    canvas.addEventListener("mousedown", (event: MouseEvent) => {
        mouseDown(event.x * ZOOM, event.y * ZOOM, 1);
        event.preventDefault();
    });

    canvas.addEventListener("mouseup", (event: MouseEvent) => {
        mouseUp(event.x * ZOOM, event.y * ZOOM, 1);
        event.preventDefault();
    });
}

function mouseDown(x: number, y: number, touchId: number) {
    let foundInventButton = false;
    let foundControlButton = false;


    // tools
    if (portraitSmall) {
        y += 160;
    }
    if (landscapeSmall) {
        x -= (-(canvas.width / 2)+370);
    }
    if ((x > canvas.width - (130 * 4)) && (y > canvas.height - (130 * 4))) {
        let xp = Math.floor((canvas.width - x) / 130);
        let yp = Math.floor((canvas.height - y) / 130);
        let index = (xp + (yp * 4)) + (inventPage*4);
        if (!isMobile() || yp === 0) {
            if (index >= 0 && index < INVENTORY.length) {
                foundInventButton = true;
                player.itemHeld = INVENTORY[index];
            }
        } else {
            if ((xp === 0 && yp === 1)) {
                inventPage++;
                if (inventPage > Math.floor((INVENTORY.length - 1) / 4)) {
                    inventPage = 0;
                }
            }
        }
    } 
    if (x > canvas.width - 680 && y > canvas.height - 140 && x < canvas.width - 680 + 126 && y < canvas.height - 140 + 125) {
        frontPlace = !frontPlace;
        foundInventButton = true;
        showTip("Placing Tiles on " + (frontPlace ? "Foreground" : "Background"));
    }
    if (portraitSmall) {
        y -= 160;
    }
    if (landscapeSmall) {
        x += (-(canvas.width / 2)+370);
    }


    foundControlButton = evalControlArea(x, y, touchId);

    if (!foundInventButton && !foundControlButton && mainAreaTouchId === 0) {
        mainAreaTouchId = touchId;
        mouseButtons[0] = true;
    }
}

function evalControlArea(x: number, y: number, touchId: number): boolean {
    if (!isMobile()) {
        return false;
    }
    keys['w'] = false;
    keys['a'] = false;
    keys['d'] = false;

    if ((y * 2 > canvas.height - 300)) {
        let xp = Math.floor((x - 20) / 160);
        let yp = Math.floor((y - (canvas.height - 300)) / 160);

        if (x > canvas.width - 180 && yp === 1) {
            // up
            keys['w'] = true;
            controllerTouchId = touchId;
            return true;
        }

        if (xp == 0 && yp === 1) {
            // left
            keys['a'] = true;
            controllerTouchId = touchId;
            return true;
        }
        if (xp == 1 && yp === 1) {
            // right
            keys['d'] = true;
            controllerTouchId = touchId;
            return true;
        }
    }

    return false;
}

function mouseUp(x: number, y: number, touchId: number) {
    if (touchId === mainAreaTouchId) {
        mainAreaTouchId = 0;
        mouseButtons[0] = false;
    }
    if (touchId === controllerTouchId) {
        keys['w'] = false;
        keys['a'] = false;
        keys['d'] = false;
        controllerTouchId = 0;
    }
}

function mouseMove(x: number, y: number, touchId: number) {
    if (touchId === mainAreaTouchId || !isMobile()) {
        mouseX = x;
        mouseY = y;
    }
    if (touchId === controllerTouchId) {
        evalControlArea(x, y, touchId);
    }
}

refreshSpriteTileMap();

const player = new Mob(uuidv4(), username, HUMAN_SKELETON, 200, (SKY_HEIGHT - 6) * TILE_SIZE);

function showChat() {
    if (networkConnected()) {
        chatInput!.style.display = "block";
        chatInput.focus();
    }
}

function sendChat(message: string) {
    if (networkConnected()) {
        sendChatMessage(player.name, message);
    }
}

function hideChat() {
    chatInput!.style.display = "none";
}

if (localStorage.getItem("head")) {
    player.head = localStorage.getItem("head")!;
}
if (localStorage.getItem("body")) {
    player.body = localStorage.getItem("body")!;
}

const bodySelect = document.getElementById("bodySelect") as HTMLSelectElement;
const headSelect = document.getElementById("headSelect") as HTMLSelectElement;
bodySelect.value = player.body;
headSelect.value = player.head;

bodySelect.addEventListener("change", (event) => {
    player.body = bodySelect.value;
    localStorage.setItem("body", player.body);
});
headSelect.addEventListener("change", (event) => {
    player.head = headSelect.value;
    localStorage.setItem("head", player.head);
});

const mobs: Mob[] = [];
mobs.push(player);
updatePlayerList(mobs);
player.itemHeld = INVENTORY[0];

requestAnimationFrame(() => { loop() });

let lastFrame = Date.now();
let focusTarget = canvas;
let portraitSmall: boolean = false;
let landscapeSmall: boolean = false;
let inventPage = 0;
let finishStartup = Date.now() + 1000;

function loop() {
    if (Date.now() > finishStartup) {
        document.getElementById("splash")!.style.display = "none";
    }
    if (Date.now() - tooltipShown > 5000) {
        tooltip.style.display = "none";
    }

    const delta = Date.now() - lastFrame;
    if (delta < 10) {
        requestAnimationFrame(() => { loop() });
        return;
    }

    animTime += 0.03;
    animTime = animTime % 1;

    canvas.width = document.body.clientWidth * ZOOM;
    canvas.height = document.body.clientHeight * ZOOM;
    const isLandscape = canvas.width > canvas.height;
    landscapeSmall = isMobile() && isLandscape && canvas.height < 800;
    portraitSmall = isMobile() && !isLandscape;

    focusTarget.focus();

    g.save();

    // draw the background clouds
    g.drawImage(getSprite('clouds'), 0, 0, canvas.width, canvas.height);
    g.fillStyle = "#445253";

    if (!networkConnected()) {
        networkUpdate(player, mobs);
        document.getElementById("serverLink")!.innerHTML = waitingForHost ? "Waiting for Host" : "Disconnected";
        requestAnimationFrame(() => { loop() });
        const logo = getSprite("logo");

        if (landscapeSmall) {
            g.drawImage(logo, (canvas.width - logo.width) / 2, 5);
            g.font = "30px Helvetica";
            g.textAlign = "center";
            g.fillText("Version _VERSION_", canvas.width / 2, logo.height + 30);
        } else if (portraitSmall) {
            g.drawImage(logo, (canvas.width - logo.width) / 2, 300);
            g.font = "30px Helvetica";
            g.textAlign = "center";
            g.fillText("Version _VERSION_", canvas.width / 2, logo.height + 330);
        } else {
            g.drawImage(logo, (canvas.width - (logo.width * 2)) / 2, 200, logo.width * 2, logo.height * 2);
            g.font = "50px Helvetica";
            g.textAlign = "center";
            g.fillText("Version _VERSION_", canvas.width / 2, 250 + (logo.height * 2));
        }

        if (resourcesLoaded() && !connecting) {
            if (portraitSmall) {
                g.translate((canvas.width / 2), (canvas.height / 2) +  540);
            } else {
                g.translate((canvas.width / 2) + 500, (canvas.height / 2) +  40);
            }
            g.scale(1.5,1.5);
            player.still();
            player.update(0, false)
            player.x = 0;
            player.flip = true;
            player.y = 0;
            player.draw(g, false);
            player.x = 200;
            player.y = (SKY_HEIGHT - 6) * TILE_SIZE;
        } else {
            g.font = "80px Helvetica";
            g.textAlign = "center";
            g.fillText("Connecting", canvas.width / 2, canvas.height / 2);
        }
        return;
    }

    if (!hosting) {
        document.getElementById("serverLink")!.innerHTML = "Connected";
    }

    if (resourcesLoaded()) {
        networkUpdate(player, mobs);

        // scroll the view based on bounds and player position
        let ox = player.x - (canvas.width / 2);
        const oy = player.y - (canvas.height / 2);
        ox = Math.min(Math.max(0, ox), (MAP_WIDTH  * TILE_SIZE) - canvas.width);
        g.translate(-Math.floor(ox), -Math.floor(oy));

        // draw the underground background
        g.fillRect(0, SKY_HEIGHT * 128, canvas.width * 5, canvas.height * 5);

        player.overX = Math.floor((mouseX + Math.floor(ox)) / TILE_SIZE);
        player.overY = Math.floor((mouseY + Math.floor(oy)) / TILE_SIZE);

        const px = Math.floor(player.x / TILE_SIZE);
        const py = Math.floor(player.y / TILE_SIZE);
        const dx = player.overX - px;
        const dy = player.overY - py;

        let canAct = (Math.abs(dx) < 2) && (dy > -3) && (dy < 2) && (dx !== 0 || dy !== 0);

        renderMap(g, player.overX,player. overY, canAct, ox, oy, canvas.width, canvas.height);
        
        // local player specifics
        player.still();

        // mining
        if ((lastWorkY !== player.overY) || (lastWorkX !== player.overX) || (!mouseButtons[0])) {
            player.damage = 0;
        }
        if (mouseButtons[0] && canAct && getTile(player.overX, player.overY, frontPlace ? 0 : 1) !== 0) {
            lastWorkX = player.overX;
            lastWorkY = player.overY;
        }

        if (mouseButtons[0] && canAct) {
            player.controls.mouse = true;
        }
        player.localUpdate();
        if (keys["d"]) {
            player.controls.right = true;
        }
        if (keys["a"]) {
            player.controls.left = true;
        }
        if (keys[" "] || keys["w"]) {
            player.controls.up = true;
        }
        for (let i=1;i<10;i++) {
            if (keys["" + i]) {
                player.itemHeld = INVENTORY[i-1];
            }
        }

        for (const mob of [...mobs]) {
            mob.update(animTime, !frontPlace);
            mob.draw(g, SHOW_BOUNDS);

            if (Date.now() - mob.lastUpdate > 10000) {
                mobs.splice(mobs.indexOf(mob), 1);
            }
        }
    }

    renderAndUpdateParticles(g);

    g.restore();
    if (portraitSmall) {
        g.save();
        g.translate(0,-160);
    }
    if (landscapeSmall) {
        g.save();
        g.translate(-(canvas.width / 2)+370, 0);
    }
    let index = 0;
    const rows = (isMobile()) ? 1 : 4;

    for (let y=0;y<rows;y++) {
        for (let x=0;x<4;x++) {
            const xp = canvas.width - ((x+1) * 130) - 10;
            const yp = canvas.height - ((y+1) * 130) - 10;
            const item = INVENTORY[index + (inventPage*4)];
            if (item) {
                if (item === player.itemHeld) {
                    g.drawImage(getSprite("ui.sloton"), xp, yp, 125, 125);
                } else {
                    g.drawImage(getSprite("ui.slotoff"), xp, yp, 125, 125);
                }
                g.drawImage(getSprite(item.sprite), xp+20 + (item.place === 0 ? 7 : 0), yp+15, 85, 85);

            }
            index++;
        }
    }
    g.drawImage(getSprite(frontPlace ? "ui.front" : "ui.back"), canvas.width - 680, canvas.height - 140, 125, 125);
    if (isMobile()) {
        const xp = canvas.width - ((0+1) * 130) - 10;
        const yp = canvas.height - ((1+1) * 130) - 10;
        g.drawImage(getSprite("ui.arrowup"), xp + 20, yp + 50, 80, 80);
    }

    if (portraitSmall || landscapeSmall) {
        g.restore();
    }
    if (isMobile()) {
        g.drawImage(getSprite("ui.left"), 20, canvas.height - 160, 140, 140);
        g.drawImage(getSprite("ui.right"), 180, canvas.height - 160, 140, 140);
        g.drawImage(getSprite("ui.up"), canvas.width - 200, canvas.height - 160, 140, 140);
    }
    lastFrame = Date.now();
    requestAnimationFrame(() => { loop() });
}