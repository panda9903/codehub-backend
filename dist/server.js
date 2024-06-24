"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_1 = require("socket.io");
const http = __importStar(require("http"));
const state_1 = require("@codemirror/state");
const server = http.createServer();
let documents = new Map();
documents.set("", {
    updates: [],
    pending: [],
    doc: state_1.Text.of(["\n\n\nStarting doc!\n\n\n"]),
});
let io = new socket_io_1.Server(server, {
    path: "/api",
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});
function getDocument(name) {
    if (documents.has(name))
        return documents.get(name);
    const documentContent = {
        updates: [],
        pending: [],
        doc: state_1.Text.of([`\n\n\nHello World from ${name}\n\n\n`]),
    };
    documents.set(name, documentContent);
    return documentContent;
}
// listening for connections from clients
io.on("connection", (socket) => {
    socket.on("pullUpdates", (documentName, version) => {
        try {
            const { updates, pending, doc } = getDocument(documentName);
            if (version < updates.length) {
                socket.emit("pullUpdateResponse", JSON.stringify(updates.slice(version)));
            }
            else {
                pending.push((updates) => {
                    socket.emit("pullUpdateResponse", JSON.stringify(updates.slice(version)));
                });
                documents.set(documentName, { updates, pending, doc });
            }
        }
        catch (error) {
            console.error("pullUpdates", error);
        }
    });
    socket.on("pushUpdates", (documentName, version, docUpdates) => {
        try {
            let { updates, pending, doc } = getDocument(documentName);
            docUpdates = JSON.parse(docUpdates);
            if (version != updates.length) {
                socket.emit("pushUpdateResponse", false);
            }
            else {
                for (let update of docUpdates) {
                    // Convert the JSON representation to an actual ChangeSet
                    // instance
                    let changes = state_1.ChangeSet.fromJSON(update.changes);
                    updates.push({
                        changes,
                        clientID: update.clientID,
                        effects: update.effects,
                    });
                    documents.set(documentName, { updates, pending, doc });
                    doc = changes.apply(doc);
                    documents.set(documentName, { updates, pending, doc });
                }
                socket.emit("pushUpdateResponse", true);
                while (pending.length)
                    pending.pop()(updates);
                documents.set(documentName, { updates, pending, doc });
            }
        }
        catch (error) {
            console.error("pushUpdates", error);
        }
    });
    socket.on("getDocument", (documentName) => {
        try {
            let { updates, doc } = getDocument(documentName);
            socket.emit("getDocumentResponse", updates.length, doc.toString());
        }
        catch (error) {
            console.error("getDocument", error);
        }
    });
    socket.on("edit", (params) => {
        socket.emit("display", params);
    });
});
const port = process.env.PORT || 8000;
server.listen(port, () => console.log(`Server listening on port: ${port}`));
