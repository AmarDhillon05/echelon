from flask import Flask, request, jsonify
from devpost import createDevpostLd, populateDevpostLd, searchForName, find
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def create_from_devpost(hackathon_name, admin):
    # Assumes confirmed name
    print("Using create_from_devpost")
    x = createDevpostLd(hackathon_name, admin)
    print("Created the leaderboard")
    populateDevpostLd(hackathon_name)
    return x


@app.route("/")
def home():
    return "Welcome to echelon"





@app.route("/devpost/search", methods=["POST"])
def search_hackathon():
    data = request.get_json()
    query = data.get("query")

    if not query:
        return jsonify({"error": "Missing 'query' parameter"}), 400

    try:
        results = searchForName(query)
        return jsonify({"results": results}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500






@app.route("/devpost/create", methods=["POST"])
#TODO - make this stream
def create_hackathon():

    data = request.get_json()
    hackathon_name = data.get("hackathon_name")
    admin = data.get("admin")

    print("Got hackathon data")

    if not hackathon_name or not admin:
        return jsonify({"error": "Missing 'hackathon_name' or 'admin'"}), 400
    
    name = find(hackathon_name)
    if name is None or name == []:
        return jsonify({"error" : "Hack not found"}), 404
    
    print("Before leaderboard request")

    try:
        new_ld = create_from_devpost(hackathon_name, admin)
        return jsonify({
            "message": "Hackathon created successfully",
            "hackathon": new_ld
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500



if __name__ == "__main__":
    app.run(debug=True)