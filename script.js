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
// CHARGEMENT INITIAL
// ==========================================

chargerAnnonces();
