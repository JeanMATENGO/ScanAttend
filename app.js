
let html5QrCode = null;
const codeAcces = "PROFUCB2026";

function nettoyageQuotidien() {
    const aujourdhui = new Date().toLocaleDateString('fr-FR');
    const dateDernierNettoyage = localStorage.getItem('date_dernier_nettoyage');
    if (dateDernierNettoyage !== aujourdhui) {
        localStorage.removeItem('sessions');
        localStorage.removeItem('attendances');
        localStorage.setItem('date_dernier_nettoyage', aujourdhui);
        const conteneur = document.getElementById('contenu-historique');
        if (conteneur) conteneur.innerHTML = "<p>Nouvelle journée, aucune donnée.</p>";
    }
}

nettoyageQuotidien();

function getAujourdhui() {
    return new Date().toLocaleDateString('fr-FR');
}

function afficherMessage(idDelElement, message, genre) {
    const zoneTexte = document.getElementById(idDelElement);
    if (!zoneTexte) return;
    zoneTexte.innerText = message;
    zoneTexte.className = `msg-box text-${genre}`;
    setTimeout(() => { zoneTexte.innerText = ""; }, 4000);
}

function AfficherEcran(id) {
    document.querySelectorAll('.carte > div').forEach(div => div.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function verifierConnexion() {
    const input = document.getElementById('code-prof');
    if (input.value === codeAcces) {
        input.value = "";
        afficherMessage("message-erreur", "Accès autorisé", "success");
        AfficherEcran('menu-prof');
    } else {
        afficherMessage("message-erreur", "Code incorrect", "error");
    }
}

async function CreerSession() {
    const info = document.getElementById('input-fac').value;
    const cours = document.getElementById('input-cours').value;
    if (!info || !cours) return afficherMessage("msg-session", "Veuillez tout remplir", "error");

    const sessionId = "SCAN-" + Date.now();
    const dateStr = getAujourdhui();

    try {
        await db.collection('sessions').doc(sessionId).set({
            id: sessionId,
            fac: info,
            cours: cours,
            date: dateStr,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        document.getElementById('resultat-qr').innerHTML = "";
        new QRCode(document.getElementById('resultat-qr'), sessionId);
        document.getElementById('info-qr').classList.remove('hidden');
        afficherMessage("msg-session", "Séance générée", "success");
    } catch (error) {
        console.error("Erreur Firestore sessions:", error);
        afficherMessage("msg-session", "Erreur de connexion", "error");
    }
}

function UtiliserCamera() {
    document.getElementById('lire').classList.remove('hidden');
    document.getElementById('btns-scan').classList.add('hidden');
    html5QrCode = new Html5Qrcode("lire");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, scanReussi)
        .catch(() => afficherMessage("msg-scan", "Caméra non disponible", "error"));
}

document.getElementById('fichier-qr').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const tempScanner = new Html5Qrcode("lire");
    tempScanner.scanFile(file, true)
        .then(scanReussi)
        .catch(() => afficherMessage("msg-scan", "QR Code non détecté", "error"));
});

async function scanReussi(decoderTexte) {
    if (html5QrCode) {
        await html5QrCode.stop().catch(() => { });
        html5QrCode = null;
    }

    try {
        const doc = await db.collection('sessions').doc(decoderTexte).get();
        if (doc.exists) {
            const session = doc.data();
            localStorage.setItem('temp_sid', decoderTexte); // Still needed for the follow-up form
            document.getElementById('session-actuelle').innerText = `${session.fac} : ${session.cours}`;
            AfficherEcran('afficher-formulaire-etudiant');
        } else {
            afficherMessage("msg-scan", "Code expiré ou invalide", "error");
            setTimeout(() => { AnnulerEtRetourner(); }, 2000);
        }
    } catch (error) {
        afficherMessage("msg-scan", "Erreur de connexion", "error");
    }
}

async function SoumettrePresence() {
    const name = document.getElementById('nom-etud').value;
    const mat = document.getElementById('mat-etud').value;
    const sid = localStorage.getItem('temp_sid');
    if (!name || !mat) return afficherMessage("msg-etudiant", "Nom et matricule requis", "error");

    try {
        await db.collection('attendances').add({
            sessionId: sid,
            name: name,
            mat: mat,
            date: getAujourdhui(),
            time: new Date().toLocaleTimeString('fr-FR'),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        afficherMessage("msg-etudiant", "Présence enregistrée !", "success");
        setTimeout(() => { AnnulerEtRetourner(); }, 1500);
    } catch (error) {
        afficherMessage("msg-etudiant", "Erreur d'enregistrement", "error");
    }
}

function AnnulerEtRetourner() {
    if (html5QrCode) { html5QrCode.stop().catch(() => { }); html5QrCode = null; }
    document.getElementById('fichier-qr').value = "";
    document.getElementById('nom-etud').value = "";
    document.getElementById('mat-etud').value = "";
    document.getElementById('input-fac').value = "";
    document.getElementById('input-cours').value = "";
    document.getElementById('resultat-qr').innerHTML = "";
    document.getElementById('lire').classList.add('hidden');
    document.getElementById('btns-scan').classList.remove('hidden');
    AfficherEcran('principal');
}

async function VoirHistorique() {
    AfficherEcran('afficher-historique');
    const conteneur = document.getElementById('contenu-historique');
    conteneur.innerHTML = "<p>Chargement...</p>";

    const aujourdhui = getAujourdhui();

    try {
        const sessionsSnapshot = await db.collection('sessions')
            .where('date', '==', aujourdhui)
            .get();

        const attendancesSnapshot = await db.collection('attendances')
            .where('date', '==', aujourdhui)
            .get();

        const sessions = sessionsSnapshot.docs.map(doc => doc.data());
        const attendances = attendancesSnapshot.docs.map(doc => doc.data());

        conteneur.innerHTML = sessions.length ? "" : "<p>Aucune donnée pour aujourd'hui.</p>";

        sessions.forEach(s => {
            const studentList = attendances.filter(a => a.sessionId === s.id);
            let html = `<div class="session-item">
                <b>${s.fac}</b> - ${s.cours}<br>
                <button class="btn btn-prof" onclick="basculerAffichage('${s.id}')">Liste (${studentList.length})</button>
                <div id="list-${s.id}" class="hidden">`;

            if (studentList.length === 0) html += "<p>Aucun présent.</p>";
            else {
                html += `<table><tr><th>Nom</th><th>Heure</th></tr>`;
                studentList.forEach(st => {
                    html += `<tr><td>${st.name}</td><td>${st.time}</td></tr>`;
                });
                html += `</table>`;
                html += `<button class="btn btn-download" onclick="exportCSV('${s.id}', '${s.cours}')">📥 Télécharger CSV</button>`;
            }
            html += `</div></div>`;
            conteneur.innerHTML += html;
        });
    } catch (error) {
        conteneur.innerHTML = "<p>Erreur lors du chargement des données.</p>";
    }
}

function basculerAffichage(id) {
    const el = document.getElementById('list-' + id);
    if (el) el.classList.toggle('hidden');
}

async function exportCSV(sid, courseName) {
    try {
        const snapshot = await db.collection('attendances')
            .where('sessionId', '==', sid)
            .get();

        const filtered = snapshot.docs.map(doc => doc.data());
        if (filtered.length === 0) return afficherMessage("msg-historique", "Rien à exporter", "error");

        let csvContent = "data:text/csv;charset=utf-8,Nom,Matricule,Heure\n";
        filtered.forEach(row => { csvContent += `${row.name},${row.mat},${row.time}\n`; });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Presence_${courseName.replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        afficherMessage("msg-historique", "Erreur export", "error");
    }
}

function toggleMenu() {
    document.getElementById('barnav').classList.toggle('active');
}

function RetourAccueil() {
    document.querySelectorAll('.onglet-content').forEach(section => section.classList.add('hidden'));
    document.getElementById('section-accueil').classList.remove('hidden');
    document.querySelectorAll('#section-accueil .carte > div').forEach(div => div.classList.add('hidden'));
    document.getElementById('principal').classList.remove('hidden');
    document.querySelectorAll('.barnav a').forEach(a => a.classList.remove('active'));
    document.querySelector('.barnav a').classList.add('active');
    document.getElementById('barnav').classList.remove('active');
}

function Naviguer(idOnglet, lienClique) {
    document.querySelectorAll('.onglet-content').forEach(section => section.classList.add('hidden'));
    document.getElementById('section-' + idOnglet).classList.remove('hidden');

    if (idOnglet === 'accueil') {
        document.querySelectorAll('#section-accueil .carte > div').forEach(div => div.classList.add('hidden'));
        document.getElementById('principal').classList.remove('hidden');
    }

    if (idOnglet === 'tableau-de-bord') {
        document.getElementById('auth-tableau').classList.remove('hidden');
        document.getElementById('stats-tableau').classList.add('hidden');
        document.getElementById('code-tableau').value = "";
        document.getElementById('msg-tableau').innerText = "";
    }

    document.querySelectorAll('.barnav a').forEach(a => a.classList.remove('active'));
    if (lienClique) lienClique.classList.add('active');
    document.getElementById('barnav').classList.remove('active');

    if (idOnglet === 'assistant-ia') {
        document.querySelectorAll('#section-assistant-ia .hidden').forEach(el => el.classList.remove('hidden'));
    }

    if (idOnglet === 'a-propos') {
        document.querySelectorAll('#section-a-propos .hidden').forEach(el => el.classList.remove('hidden'));
    }
}

function AccesTableauBord() {
    const input = document.getElementById('code-tableau');
    const msg = document.getElementById('msg-tableau');
    if (input.value !== codeAcces) {
        msg.innerText = "Code incorrect";
        msg.className = "msg-box text-error";
        return;
    }
    msg.innerText = "Accès autorisé";
    msg.className = "msg-box text-success";
    document.getElementById('auth-tableau').classList.add('hidden');
    document.getElementById('stats-tableau').classList.remove('hidden');
    AfficherStats();
}

async function AfficherStats() {
    const conteneur = document.getElementById('liste-stats');
    conteneur.innerHTML = "<p>Chargement...</p>";

    const aujourdhui = getAujourdhui();

    try {
        const sessionsSnapshot = await db.collection('sessions')
            .where('date', '==', aujourdhui)
            .get();

        const attendancesSnapshot = await db.collection('attendances')
            .where('date', '==', aujourdhui)
            .get();

        const sessions = sessionsSnapshot.docs.map(doc => doc.data());
        const attendances = attendancesSnapshot.docs.map(doc => doc.data());

        if (sessions.length === 0) {
            conteneur.innerHTML = "<p>Aucune donnée pour aujourd'hui.</p>";
            return;
        }

        conteneur.innerHTML = "";
        sessions.forEach(s => {
            const nb = attendances.filter(a => a.sessionId === s.id).length;
            conteneur.innerHTML += `
                <div class="session-item-stats">
                    <span><strong>${s.cours}</strong> (${s.fac})</span>
                    <span class="text-success"><strong>${nb} présents</strong></span>
                </div>
            `;
        });
    } catch (error) {
        conteneur.innerHTML = "<p>Erreur stats.</p>";
    }
}
// --- LOGIQUE ASSISTANT IA (SQUELETTE) ---
function EnvoyerMessage() {
    const input = document.getElementById('user-input');
    const chatBox = document.getElementById('chat-box');
    if (!input.value.trim()) return;

    // Message utilisateur
    chatBox.innerHTML += `<div class="user-msg">${input.value}</div>`;

    // Simulation réponse bot (En attendant ton API Gemini)
    const question = input.value.toLowerCase();
    let reponse = "Désolé, je ne connais que l'application ScanAttend. Posez-moi une question sur le scan ou les présences.";

    if (question.includes("comment ça marche")) reponse = "Le prof génère un QR code et l'étudiant le scanne pour marquer sa présence.";
    if (question.includes("perdu mes données")) reponse = "Les données sont effacées automatiquement chaque jour à minuit pour plus de sécurité.";

    setTimeout(() => {
        chatBox.innerHTML += `<div class="bot-msg">${reponse}</div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    }, 1000);

    input.value = "";
    chatBox.scrollTop = chatBox.scrollHeight;
}