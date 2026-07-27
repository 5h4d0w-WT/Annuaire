from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import stripe
import uuid
import os

load_dotenv()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID")

app = Flask(__name__)
CORS(app)


# ==================================================
# STOCKAGE TEMPORAIRE DES ANNONCES
# ==================================================

annonces = {}


# ==================================================
# TEST DU SERVEUR
# ==================================================

@app.route("/", methods=["GET"])
def accueil():
    return jsonify({
        "message": "Backend de l'annuaire opérationnel"
    })


# ==================================================
# CRÉER UNE ANNONCE
# ==================================================

@app.route("/api/annonces", methods=["POST"])
def creer_annonce():

    donnees = request.get_json()

    if not donnees:
        return jsonify({
            "erreur": "Aucune donnée reçue"
        }), 400

    numero = donnees.get("numero")
    description = donnees.get("description")
    infosup = donnees.get("infosup")
    categorie = donnees.get("categorie")

    if not numero or not description or not categorie:
        return jsonify({
            "erreur": "Le numéro, la description et la catégorie sont obligatoires"
        }), 400

    # Identifiants uniques
    id_annonce = str(uuid.uuid4())
    code_suppression = str(uuid.uuid4())

    annonce = {
        "id": id_annonce,
        "numero": numero,
        "description": description,
        "infosup": infosup,
        "categorie": categorie,

        # Paiement
        "paiement": False,
        "active": False
    }

    annonces[id_annonce] = {
        "annonce": annonce,
        "code_suppression": code_suppression
    }

    return jsonify({
        "message": "Annonce créée. Paiement requis.",
        "id_annonce": id_annonce
    }), 201


# ==================================================
# PAIEMENT STRIPE CHECKOUT
# ==================================================

@app.route("/api/paiement", methods=["POST"])
def paiement():

    donnees = request.get_json()

    if not donnees:
        return jsonify({
            "erreur": "Aucune donnée reçue"
        }), 400

    id_annonce = donnees.get("id_annonce")

    if id_annonce not in annonces:
        return jsonify({
            "erreur": "Annonce introuvable"
        }), 404

    try:

        session = stripe.checkout.Session.create(

            mode="subscription",

            line_items=[
                {
                    "price": STRIPE_PRICE_ID,
                    "quantity": 1
                }
            ],

           success_url=(
    "https://5h4d0w-wt.github.io/Annuaire/"
    "?paiement=succes"
    "&session_id={CHECKOUT_SESSION_ID}"
),

cancel_url=(
    "https://5h4d0w-wt.github.io/Annuaire/"
    "?paiement=annule"
),

            metadata={
                "id_annonce": id_annonce
            }

        )

        return jsonify({
            "url": session.url
        }), 200

    except Exception as erreur:

        print("ERREUR STRIPE :", erreur)

        return jsonify({
            "erreur": "Impossible de créer le paiement Stripe"
        }), 500


# ==================================================
# AFFICHER LES ANNONCES D'UNE CATÉGORIE
# ==================================================

@app.route("/api/annonces/<categorie>", methods=["GET"])
def afficher_annonces(categorie):

    resultats = []

    for element in annonces.values():

        annonce = element["annonce"]

        if (
            annonce["categorie"] == categorie
            and annonce["active"] is True
        ):
            resultats.append({
                "id": annonce["id"],
                "numero": annonce["numero"],
                "description": annonce["description"],
                "infosup": annonce["infosup"]
            })

    return jsonify(resultats), 200


# ==================================================
# SUPPRIMER UNE ANNONCE
# ==================================================

@app.route("/api/annonces/supprimer", methods=["POST"])
def supprimer_annonce():

    donnees = request.get_json()

    if not donnees:
        return jsonify({
            "erreur": "Aucune donnée reçue"
        }), 400

    code_suppression = donnees.get("code_suppression")

    if not code_suppression:
        return jsonify({
            "erreur": "Code de suppression manquant"
        }), 400

    id_a_supprimer = None

    for id_annonce, element in annonces.items():

        if element["code_suppression"] == code_suppression:
            id_a_supprimer = id_annonce
            break

    if id_a_supprimer is None:
        return jsonify({
            "erreur": "Code de suppression incorrect"
        }), 404

    # Suppression de l'annonce
    del annonces[id_a_supprimer]

    return jsonify({
        "message": "Annonce supprimée définitivement"
    }), 200


# ==================================================
# LANCEMENT DU SERVEUR
# ==================================================

if __name__ == "__main__":

    port = int(os.environ.get("PORT", 5000))

    app.run(
        host="0.0.0.0",
        port=port
    )
