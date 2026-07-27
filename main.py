from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from pymongo import MongoClient
import stripe
import uuid
import os

load_dotenv()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME")

client = MongoClient(MONGODB_URI)

db = client[MONGODB_DB_NAME]

annonces_collection = db["annonces"]

app = Flask(__name__)
CORS(app)

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
    "active": False,

    # Identifiant de l'abonnement Stripe
    "stripe_subscription_id": None
}

    annonces_collection.insert_one({
        "annonce": annonce,
        "code_suppression": code_suppression
    })

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

    annonce_existante = annonces_collection.find_one({
        "annonce.id": id_annonce
    })

    if annonce_existante is None:
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
            },
                
            subscription_data={
                "metadata": {
                "id_annonce": id_annonce
        }
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
# WEBHOOK STRIPE
# ==================================================

@app.route("/webhook", methods=["POST"])
def webhook_stripe():

    payload = request.data
    signature = request.headers.get("Stripe-Signature")

    try:

        evenement = stripe.Webhook.construct_event(
            payload,
            signature,
            STRIPE_WEBHOOK_SECRET
        )

    except ValueError:

        return "Payload invalide", 400

    except stripe.error.SignatureVerificationError:

        return "Signature invalide", 400


    # Paiement initial terminé
    if evenement["type"] == "checkout.session.completed":

        session = evenement["data"]["object"]

        id_annonce = session["metadata"].get("id_annonce")

        abonnement_id = session.get("subscription")

        if id_annonce and abonnement_id:

            annonces_collection.update_one(

                {
                    "annonce.id": id_annonce
                },

                {
                    "$set": {
                        "annonce.paiement": True,
                        "annonce.active": True,
                        "annonce.stripe_subscription_id": abonnement_id
                    }
                }

            )


    # Renouvellement mensuel payé
    elif evenement["type"] == "invoice.paid":

        facture = evenement["data"]["object"]

        abonnement_id = facture.get("subscription")

        if abonnement_id:

            annonces_collection.update_one(

                {
                    "annonce.stripe_subscription_id":
                    abonnement_id
                },

                {
                    "$set": {
                        "annonce.paiement": True,
                        "annonce.active": True
                    }
                }

            )


    # Abonnement terminé
    elif evenement["type"] == "customer.subscription.deleted":

        abonnement = evenement["data"]["object"]

        abonnement_id = abonnement["id"]

        annonces_collection.delete_one(

            {
                "annonce.stripe_subscription_id":
                abonnement_id
            }

        )


    return "OK", 200

# ==================================================
# AFFICHER LES ANNONCES D'UNE CATÉGORIE
# ==================================================

@app.route("/api/annonces/<categorie>", methods=["GET"])
def afficher_annonces(categorie):

    resultats = []

    annonces_trouvees = annonces_collection.find({
        "annonce.categorie": categorie,
        "annonce.active": True
    })

    for element in annonces_trouvees:

            annonce = element["annonce"]

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

    annonce_trouvee = annonces_collection.find_one({
        "code_suppression": code_suppression
    })

    if annonce_trouvee is None:
        return jsonify({
            "erreur": "Code de suppression incorrect"
        }), 404

    # Suppression de l'annonce
    annonces_collection.delete_one({
        "_id": annonce_trouvee["_id"]
    })

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
