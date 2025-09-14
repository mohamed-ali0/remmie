import os
from dotenv import load_dotenv

load_dotenv()

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ASSISTANT_ID = os.getenv("ASSISTANT_ID")

# Database Configuration
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://admin:mongo_password_123@mongo:27017/")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE") or os.getenv("MONGO_DATABASE", "remmie_ai")

# Ensure MONGODB_DATABASE is always a string
if not isinstance(MONGODB_DATABASE, str) or not MONGODB_DATABASE.strip():
    MONGODB_DATABASE = "remmie_ai"

# Error Messages
ERROR_MESSAGE = "We are facing an issue at this moment, please try after sometime."

#Amadeus Configuration
AMADEUS_CLIENT_ID = os.getenv("AMADEUS_CLIENT_ID")
AMADEUS_CLIENT_SECRET = os.getenv("AMADEUS_CLIENT_SECRET")