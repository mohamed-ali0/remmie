import config
import requests
import json

def format_messages(messages: list[dict[str, any]]) -> list[dict[str, str]]:
    """Format messages for OpenAI conversation history"""
    formatted_messages = []
    for msg in messages:
        if isinstance(msg, dict):
            # Handle message format {"query": "...", "response": "..."}
            if "query" in msg and "response" in msg:
                formatted_messages.append({
                    "role": "user",
                    "content": str(msg['query'])
                })
                formatted_messages.append({
                    "role": "assistant",
                    "content": str(msg['response'])
                })
            # Handle message format {"message": "...", "role": "..."}
            elif "message" in msg and "role" in msg:
                formatted_messages.append({
                    "role": str(msg["role"]),
                    "content": str(msg["message"])
                })
            # Handle message format {"text": "...", "sender": "..."}
            elif "text" in msg and "sender" in msg:
                role = "assistant" if msg["sender"] == "bot" else "user"
                formatted_messages.append({
                    "role": role,
                    "content": str(msg["text"])
                })
    return formatted_messages
def get_amadeus_token():
    data = {
        "client_id": config.AMADEUS_CLIENT_ID,
        "client_secret": config.AMADEUS_CLIENT_SECRET,
        "grant_type": "client_credentials"
    }

    response = requests.post(
        "https://test.api.amadeus.com/v1/security/oauth2/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    return response.json()["access_token"]
def call_amadeus_search(params):
    try:
        print("🔵 Calling Amadeus API with params:", params)

        # Get Amadeus API token
        token = get_amadeus_token()
        headers = {
            "Authorization": f"Bearer {token}"
        }

        # Build the API query parameters
        query = {
            "originLocationCode": params["originLocationCode"],
            "destinationLocationCode": params["destinationLocationCode"],
            "departureDate": params["departureDate"],
            "adults": params["adults"],
            "max": params.get("maxResults", 5)
        }

        if "returnDate" in params and params["returnDate"]:
            query["returnDate"] = params["returnDate"]

        if params.get("allowLayovers") is False:
            query["nonStop"] = "true"  # Important: nonStop must be a string ("true" or "false")

        print(f"🔵 Final Query Params for API:", query)

        # Send the API request
        response = requests.get(
            "https://test.api.amadeus.com/v2/shopping/flight-offers",
            headers=headers,
            params=query
        )

        print(f"🔵 Amadeus API Status Code:", response.status_code)
        response_json = response.json()

        # Pretty print the full response for debugging
        print("🔵 Amadeus API Response JSON:", json.dumps(response_json, indent=2))

        # Check if the API returned an error
        if response.status_code != 200:
            error_message = response_json.get("errors", [{}])[0].get("detail", "Unknown error.")
            print(f"🔴 Amadeus API Error Detail: {error_message}")
            return f"Sorry, something went wrong: {error_message}"

        # Format and return the flight offers in a friendly text
        return format_flight_offers(response_json)

    except Exception as e:
        print(f"🔴 Error while calling Amadeus API: {str(e)}")
        return "Sorry, something went wrong while searching for flights."
def format_flight_offers(response_json: dict) -> str:
    """
    Takes Amadeus API raw flight offer response and returns a human-friendly text.
    """
    try:
        if not response_json.get("data"):
            return "Sorry, I couldn't find any flight offers for your trip."

        offers = response_json["data"]
        message = "Here are some flight options for you:\n\n"

        for offer in offers[:5]:  # Limit to top 5 results
            price = offer["price"]["grandTotal"]
            currency = offer["price"]["currency"]
            itineraries = offer["itineraries"]

            outbound = itineraries[0]["segments"]
            inbound = itineraries[1]["segments"] if len(itineraries) > 1 else []

            # Outbound summary
            first_outbound = outbound[0]
            last_outbound = outbound[-1]

            departure_city = first_outbound["departure"]["iataCode"]
            arrival_city = last_outbound["arrival"]["iataCode"]
            departure_time = first_outbound["departure"]["at"].split("T")[0]
            duration = itineraries[0]["duration"]

            # Layovers
            layovers = len(outbound) - 1
            layover_info = f" with {layovers} layover(s)" if layovers > 0 else " (direct flight)"

            message += f"✈️ {departure_city} → {arrival_city} on {departure_time}\n"
            message += f"Duration: {duration.replace('PT', '').lower()}{layover_info}\n"
            message += f"Price: {price} {currency}\n"
            message += "-"*30 + "\n"

        return message

    except Exception as e:
        print(f"Error formatting flight offers: {e}")
        return "Sorry, something went wrong while preparing the flight results."
