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
        if(conteneur) conteneur.innerHTML = "<p>Nouvelle journée, aucune donnée.</p>";
    }
}

nettoyageQuotidien();

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
    if(input.value === codeAcces) {
        input.value = "";
        afficherMessage("message-erreur", "Accès autorisé", "success");
        AfficherEcran('menu-prof');
    } else {
        afficherMessage("message-erreur", "Code incorrect", "error");
    }
}

function CreerSession() {
    const info = document.getElementById('input-fac').value;
    const cours = document.getElementById('input-cours').value;
    if(!info || !cours) return afficherMessage("msg-session", "Veuillez tout remplir", "error");
    
    const sessionId = "SCAN-" + Date.now();
    const donneeSession = {
        id: sessionId, fac: info, cours: cours,
        date: new Date().toLocaleDateString('fr-FR')
    };
    
    let sessions = JSON.parse(localStorage.getItem('sessions') || '[]');
    sessions.push(donneeSession);
    localStorage.setItem('sessions', JSON.stringify(sessions));
    
    document.getElementById('resultat-qr').innerHTML = "";
    new QRCode(document.getElementById('resultat-qr'), sessionId);
    document.getElementById('info-qr').classList.remove('hidden');
    afficherMessage("msg-session", "Séance générée", "success");
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
    if(html5QrCode) {
        await html5QrCode.stop().catch(() => {});
        html5QrCode = null;
    }
    nettoyageQuotidien();
    const sessions = JSON.parse(localStorage.getItem('sessions') || '[]');
    const session = sessions.find(s => s.id === decoderTexte);
    if(session) {
        localStorage.setItem('temp_sid', decoderTexte);
        document.getElementById('session-actuelle').innerText = `${session.fac} : ${session.cours}`;
        AfficherEcran('afficher-formulaire-etudiant');
    } else {
        afficherMessage("msg-scan", "Code expiré ou invalide", "error");
        setTimeout(() => { AnnulerEtRetourner(); }, 2000);
    }
}

function SoumettrePresence(){
    const name = document.getElementById('nom-etud').value;
    const mat = document.getElementById('mat-etud').value;
    const sid = localStorage.getItem('temp_sid');
    if(!name || !mat) return afficherMessage("msg-etudiant", "Nom et matricule requis", "error");

    let attendances = JSON.parse(localStorage.getItem('attendances') || '[]');
    attendances.push({
        sessionId: sid, name: name, mat: mat,
        time: new Date().toLocaleTimeString('fr-FR')
    });
    localStorage.setItem('attendances', JSON.stringify(attendances));
    afficherMessage("msg-etudiant", "Présence enregistrée !", "success");
    setTimeout(() => { AnnulerEtRetourner(); }, 1500);
}

function AnnulerEtRetourner() {
    if(html5QrCode) { html5QrCode.stop().catch(() => {}); html5QrCode = null; }
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

function VoirHistorique() {
    nettoyageQuotidien();
    AfficherEcran('afficher-historique');
    const sessions = JSON.parse(localStorage.getItem('sessions') || '[]');
    const attendances = JSON.parse(localStorage.getItem('attendances') || '[]');
    const conteneur = document.getElementById('contenu-historique');
    conteneur.innerHTML = sessions.length ? "" : "<p>Aucune donnée pour aujourd'hui.</p>";
    
    sessions.forEach(s => {
        const studentList = attendances.filter(a => a.sessionId === s.id);
        let html = `<div class="session-item">
            <b>${s.fac}</b> - ${s.cours}<br>
            <button class="btn btn-prof" onclick="basculerAffichage('${s.id}')">Liste (${studentList.length})</button>
            <div id="list-${s.id}" class="hidden">`;
        
        if(studentList.length === 0) html += "<p>Aucun présent.</p>";
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
}

function basculerAffichage(id) { 
    document.getElementById('list-'+id).classList.toggle('hidden'); 
}

function exportCSV(sid, courseName) {
    const allData = JSON.parse(localStorage.getItem('attendances') || '[]');
    const filtered = allData.filter(a => a.sessionId === sid);
    if(filtered.length === 0) return afficherMessage("msg-historique", "Rien à exporter", "error");
    
    let csvContent = "data:text/csv;charset=utf-8,Nom,Matricule,Heure\n";
    filtered.forEach(row => { csvContent += `${row.name},${row.mat},${row.time}\n`; });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Presence_${courseName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}