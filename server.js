#!/usr/bin/env node

const klaw = require("klaw");
const ps = require("ps-node");
const fs = require("fs-extra");
const home = require("os").homedir();
const os = process.platform;

const paths = {
    darwin: {
        epm: `${home}/.config/epm`,
        exodus: `${home}/Library/Application Support/Exodus`
    },
    win32: {
        epm: `${home}/AppData/Roaming/epm`,
        exodus: `${home}/AppData/Roaming/Exodus`
    },
    linux: {
        epm: `${home}/.config/epm`,
        exodus: `${home}/.config/Exodus`
    }
}

const commands = {
    use: async function(params) {
        const exodus = await fs.pathExists(paths[os].exodus);
        if (params.name === params.active) {
            console.log(">", params.name);
        } else if (params.name === "epm" || (params.name === "backup" && exodus && !params.active)) {
            console.log("Invalid profile name.");
        } else if (params.locked) {
            console.log("Please quit Exodus before switching profiles.");
        } else {
            await fs.ensureDir(`${paths[os].epm}/${params.name}`);
            if (exodus && !params.active) await fs.move(paths[os].exodus, `${paths[os].epm}/backup`);
            else if (exodus) await fs.move(paths[os].exodus, `${paths[os].epm}/${params.active}`);
            await fs.move(`${paths[os].epm}/${params.name}`, paths[os].exodus);
            await fs.outputJson(`${paths[os].epm}/.config`, {active: params.name});
            console.log(">", params.name);
        }
    },
    list: async function(params) {
        if (params.active) console.log(">", params.active);
        klaw(paths[os].epm, {depthLimit:0}).on("data", item => {
            item = item.path.split(os === "win32" ? "\\" : "/").pop(-1);
            if (!["epm", ".config", ".DS_Store"].includes(item)) console.log(" ", item);
        });
    },
    delete: async function(params) {
        if (params.name !== params.active) {
            const exists = await fs.pathExists(`${paths[os].epm}/${params.name}`);
            if (exists) {
                const rl = require("readline").createInterface(process.stdin, process.stdout);
                rl.question(`Are you sure you want to permanently delete "${params.name}"? (yes/no) `, answer => {
                    if (answer === "yes") {
                        fs.remove(`${paths[os].epm}/${params.name}`).then(() => console.log(`"${params.name}" has been deleted.`));
                    }
                    rl.close();
                });
            } else console.log(`"${params.name}" doesn't exist.`);
        } else console.log(`"${params.name}" is currently active. Please switch to another profile before deleting.`);
    },
    rename: async function(params) {
        const current = await fs.pathExists(`${paths[os].epm}/${params.name}`);
        const exists = await fs.pathExists(`${paths[os].epm}/${params.target}`);
        if (params.name === params.active && !exists) {
            await fs.outputJson(`${paths[os].epm}/.config`, {active:params.target});
            console.log("Your profile has been renamed.");
        } else if (current && !exists && params.target !== params.active) {
            await fs.move(`${paths[os].epm}/${params.name}`, `${paths[os].epm}/${params.target}`);
            console.log("Your profile has been renamed.");
        } else console.log("Could not rename profile.");
    }
}

const start = async function(locked) {
    const params = {
        locked: locked,
        name: process.argv[3],
        target: process.argv[4]
    }
    await fs.ensureDir(paths[os].epm);
    const config = await fs.pathExists(`${paths[os].epm}/.config`);
    if (config) {
        const status = await fs.readJson(`${paths[os].epm}/.config`);
        params.active = status.active;
    }
    commands[process.argv[2]](params);
}

ps.lookup({command: "Exodus"}, (error, results) => {
    if (!error && process.argv[2]) start(results.length > 0);
});
