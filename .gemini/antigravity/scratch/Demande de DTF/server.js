const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e8 // 100 Mo pour les logos haute résolution
});

const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
    if (err) console.error('Erreur ouverture BDD:', err);
    else console.log('Base de données SQLite connectée.');
});

// Création de la table avec le nouveau champ "checked"
db.run(`CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client TEXT,
    commande TEXT,
    logo TEXT,
    couleur TEXT,
    dimension TEXT,
    quantite INTEGER,
    checked INTEGER DEFAULT 0,
    archived INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('Un utilisateur connecté:', socket.id);

    // Envoi des requêtes non archivées
    db.all(`SELECT * FROM requests WHERE archived = 0 ORDER BY id DESC`, [], (err, rows) => {
        if (!err) socket.emit('load_requests', rows);
    });

    // Ajouter une demande
    socket.on('add_request', (data) => {
        const { client, commande, logo, couleur, dimension, quantite } = data;
        const stmt = db.prepare(`INSERT INTO requests (client, commande, logo, couleur, dimension, quantite) VALUES (?, ?, ?, ?, ?, ?)`);
        
        stmt.run([client, commande, logo, couleur, dimension, quantite], function(err) {
            if (!err) {
                const newRequest = { id: this.lastID, client, commande, logo, couleur, dimension, quantite, checked: 0, archived: 0 };
                io.emit('request_added', newRequest);
            }
        });
        stmt.finalize();
    });

    // Toggle Check (Rayé/Normal)
    socket.on('toggle_check', (data) => {
        const { id, checked } = data;
        db.run(`UPDATE requests SET checked = ? WHERE id = ?`, [checked ? 1 : 0, id], (err) => {
            if (!err) io.emit('request_updated', { id, checked: checked ? 1 : 0 });
        });
    });

    // Supprimer une demande
    socket.on('delete_request', (id) => {
        db.run(`DELETE FROM requests WHERE id = ?`, [id], (err) => {
            if (!err) io.emit('request_deleted', id);
        });
    });

    // Archiver la production (tous ceux qui sont cochés et non archivés)
    socket.on('archive_production', () => {
        db.run(`UPDATE requests SET archived = 1 WHERE checked = 1 AND archived = 0`, function(err) {
            if (!err) {
                io.emit('production_archived');
            }
        });
    });

    // Récupérer les données pour imprimer (les lignes cochées non archivées ?)
    // Ou imprimer les archives ? L'utilisateur dit "Toutes les demandes cochées"
    socket.on('get_print_data', () => {
        // Dans ce workflow, on imprime les demandes en cours qui sont cochées.
        db.all(`SELECT * FROM requests WHERE checked = 1 AND archived = 0 ORDER BY id DESC`, [], (err, rows) => {
            if (!err) socket.emit('print_data_ready', rows);
        });
    });

    socket.on('disconnect', () => {
        console.log('Déconnexion:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur en ligne sur http://localhost:${PORT}`);
});
