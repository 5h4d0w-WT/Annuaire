const formulaire = document.getElementById("formulaire-ajout");
const resultats = document.getElementById("resultats");

const formulaireSuppression =
    document.getElementById("formulaire-suppression");

const codeSuppressionInput =
    document.getElementById("code-suppression");

const messageSuppression =
    document.getElementById("message-suppression");

const zonePaiement =
    document.getElementById("zone-paiement");

const boutonPaiement =
    document.getElementById("bouton-paiement");

const confirmationAnnonce =
    document.getElementById("confirmation-annonce");

const codeAffiche =
    document.getElementById("code-affiche");


// ==========================================
// STOCKAGE LOCAL (survit à la redirection Stripe)
// ==========================================

const CLE_STOCKAGE = "annuaire_annonce_en_attente";


// ==========================================
// ADRESSE DU BACKEND
// ==========================================

const URL_BACKEND = "https://annuaire-ad5k.onrender.com";


// ==========================================
// ANNONCE EN ATTENTE DE PAIEMENT
// ==========================================

let idAnnonceEnAttente = null;


// ==========================================
// CATÉGORIE DE LA PAGE ACTUELLE
// ==========================================

const categorie =
    document.body.dataset.categorie;


// ==========================================
// CRÉATION DE L'ANNONCE
// ==========================================

formulaire.addEventListener("submit", async function(event) {

    event.preventDefault();


    const numero =
        document.getElementById("num").value.trim();

    const description =
        document.getElementById("description").value.trim();

    const infosup =
        document.getElementById("infosup").value.trim();


    try {

        const reponse = await fetch(
            `${URL_BACKEND}/api/annonces`,
            {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    numero: numero,

                    description: description,

                    infosup: infosup,

                    categorie: categorie

                })

            }
        );


        const donnees =
            await reponse.json();


        if (!reponse.ok) {

            alert(
                donnees.erreur ||
                "Erreur lors de la création de l'annonce."
            );

            return;

        }


        // On conserve l'identifiant
        // pour le paiement

        idAnnonceEnAttente =
            donnees.id_annonce;


        // On sauvegarde aussi dans le stockage local :
        // après le paiement, Stripe redirige vers une
        // page entièrement rechargée, donc les variables
        // JS ci-dessus seront perdues. Le stockage local,
        // lui, survit à ce rechargement.

        localStorage.setItem(
            CLE_STOCKAGE,
            JSON.stringify({
                id_annonce: donnees.id_annonce,
                code_suppression: donnees.code_suppression,
                categorie: categorie
            })
        );


        // On affiche la zone de paiement

        zonePaiement.classList.remove(
            "zone-cachee"
        );


        // On cache le formulaire

        formulaire.style.display =
            "none";


    } catch (erreur) {

        console.error(erreur);

        alert(
            "Impossible de contacter le backend."
        );

    }

});


// ==========================================
// PAIEMENT STRIPE CHECKOUT
// ==========================================

boutonPaiement.addEventListener(
    "click",
    async function() {

        if (!idAnnonceEnAttente) {

            return;

        }

        boutonPaiement.disabled = true;

        boutonPaiement.textContent =
            "Redirection vers Stripe...";

        try {

            const reponse = await fetch(

                `${URL_BACKEND}/api/paiement`,

                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        id_annonce:
                            idAnnonceEnAttente

                    })

                }

            );

            const donnees =
                await reponse.json();

            if (!reponse.ok) {

                alert(

                    donnees.erreur ||

                    "Impossible de démarrer le paiement."

                );

                boutonPaiement.disabled = false;

                boutonPaiement.textContent =
                    "Payer et publier mon annonce";

                return;

            }

            // Redirection vers la vraie page Stripe

            window.location.href =
                donnees.url;

        }

        catch (erreur) {

            console.error(erreur);

            alert(
                "Impossible de contacter le backend."
            );

            boutonPaiement.disabled = false;

            boutonPaiement.textContent =
                "Payer et publier mon annonce";

        }

    }

);


// ==========================================
// CHARGER LES ANNONCES
// ==========================================

async function chargerAnnonces() {


    try {

        const reponse = await fetch(

            `${URL_BACKEND}/api/annonces/${categorie}`

        );


        const annonces =
            await reponse.json();


        resultats.innerHTML = "";


        annonces.forEach(function(annonce) {


            const nouvelleLigne =
                document.createElement("tr");


            nouvelleLigne.innerHTML = `

                <td>
                    ${annonce.description}
                </td>

                <td>
                    ${annonce.infosup}
                </td>

                <td>
                    ${annonce.numero}
                </td>

            `;


            resultats.appendChild(
                nouvelleLigne
            );

        });


    } catch (erreur) {

        console.error(erreur);

    }

}


// ==========================================
// SUPPRESSION D'UNE ANNONCE
// ==========================================

formulaireSuppression.addEventListener(
    "submit",
    async function(event) {


        event.preventDefault();


        const codeSuppression =
            codeSuppressionInput.value.trim();


        try {

            const reponse = await fetch(

                `${URL_BACKEND}/api/annonces/supprimer`,

                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        code_suppression:
                            codeSuppression

                    })

                }

            );


            const donnees =
                await reponse.json();


            if (!reponse.ok) {

                messageSuppression.textContent =
                    donnees.erreur;

                return;

            }


            messageSuppression.textContent =
                "Votre annonce a bien été supprimée.";


            formulaireSuppression.reset();


            // Recharge les annonces

            chargerAnnonces();


        } catch (erreur) {

            console.error(erreur);

            messageSuppression.textContent =
                "Impossible de contacter le backend.";

        }

    }

);


// ==========================================
// RETOUR DEPUIS STRIPE (succès ou annulation)
// ==========================================

async function verifierEtAfficherConfirmation(idAnnonce, categorieAnnonce) {

    // Le webhook Stripe peut mettre quelques secondes
    // à traiter le paiement côté serveur. On vérifie
    // donc plusieurs fois, avec une petite pause entre
    // chaque tentative, avant d'abandonner.

    const tentativesMax = 10;

    for (let i = 0; i < tentativesMax; i++) {

        try {

            const reponse = await fetch(
                `${URL_BACKEND}/api/annonces/${categorieAnnonce}`
            );

            const annonces = await reponse.json();

            const estPubliee = annonces.some(function(annonce) {
                return annonce.id === idAnnonce;
            });

            if (estPubliee) {
                return true;
            }

        } catch (erreur) {

            console.error(erreur);

        }

        await new Promise(function(resolve) {
            setTimeout(resolve, 1500);
        });

    }

    return false;

}

async function gererRetourPaiement() {

    const parametres = new URLSearchParams(window.location.search);
    const statutPaiement = parametres.get("paiement");

    if (!statutPaiement) {
        return;
    }

    const donneesStockees = localStorage.getItem(CLE_STOCKAGE);
    const infosAnnonce = donneesStockees ? JSON.parse(donneesStockees) : null;

    // On retire les paramètres de l'URL pour éviter
    // de rejouer cette logique si l'utilisateur
    // recharge la page plus tard.

    const urlPropre = window.location.pathname;
    window.history.replaceState({}, "", urlPropre);

    if (statutPaiement === "annule") {

        alert("Paiement annulé. Vous pouvez réessayer quand vous le souhaitez.");

        zonePaiement.classList.add("zone-cachee");
        formulaire.style.display = "";

        return;

    }

    if (statutPaiement === "succes") {

        if (!infosAnnonce) {

            // Cas rare : stockage local vide (navigateur en
            // navigation privée, cache vidé...). On affiche
            // quand même un message pour ne pas laisser
            // l'utilisateur sans réponse.

            alert(
                "Paiement confirmé, mais votre code de suppression n'a " +
                "pas pu être retrouvé sur cet appareil. Contactez-nous à " +
                "annuaire.site@outlook.com avec votre email de paiement " +
                "si vous en avez besoin."
            );

            return;

        }

        formulaire.style.display = "none";
        zonePaiement.classList.add("zone-cachee");

        boutonPaiement.disabled = true;
        boutonPaiement.textContent = "Vérification du paiement...";

        const estPubliee = await verifierEtAfficherConfirmation(
            infosAnnonce.id_annonce,
            infosAnnonce.categorie
        );

        confirmationAnnonce.classList.remove("zone-cachee");
        codeAffiche.textContent = infosAnnonce.code_suppression;

        if (!estPubliee) {

            // Le paiement est confirmé par Stripe, mais le
            // serveur n'a pas encore fini de traiter le
            // webhook. L'annonce va apparaître automatiquement
            // d'ici peu, pas besoin de repayer.

            const messagePatience = document.createElement("p");

            messagePatience.textContent =
                "Votre paiement a bien été pris en compte. Si votre " +
                "annonce n'apparaît pas tout de suite dans le tableau, " +
                "rechargez la page dans une minute.";

            confirmationAnnonce.appendChild(messagePatience);

        } else {

            chargerAnnonces();

        }

        localStorage.removeItem(CLE_STOCKAGE);

    }

}


// ==========================================
// CHARGEMENT INITIAL
// ==========================================

chargerAnnonces();
gererRetourPaiement();
