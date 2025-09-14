<?php
echo "hi";

exit();
require 'vendor/autoload.php';
use Dotenv\Dotenv;

// Load environment variables
$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

echo "hi";
try {
    
    $db = new PDO("mysql:host={$_ENV['DB_HOST']};dbname={$_ENV['DB_DATABASE']};charset=utf8mb4", $_ENV['DB_USERNAME'], $_ENV['DB_PASSWORD']);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "Connected!";
} catch (PDOException $e) {
    echo "Connection failed: " . $e->getMessage();
}
exit();
$dbPrefix=$_ENV['DB_PREFIX'];
// Initialize database connection


$db = new PDO("mysql:host={$_ENV['DB_HOST']};dbname={$_ENV['DB_DATABASE']};charset=utf8mb4", $_ENV['DB_USERNAME'], $_ENV['DB_PASSWORD']);
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Create conversations table with improved structure
$db->exec("CREATE TABLE IF NOT EXISTS ".$dbPrefix."conversations (
    phone_number VARCHAR(20) PRIMARY KEY,
    step VARCHAR(50),
    
    from_name VARCHAR(100),
    from_code VARCHAR(3),
    to_name VARCHAR(100),
    to_code VARCHAR(3),
    departure_date DATE,
    needs_return TINYINT(1),
    return_date DATE,
    adults INT DEFAULT 1,
    children INT DEFAULT 0,
    
    departure_flights TEXT,
    return_flights TEXT,
    selected_departure TEXT,
    selected_return TEXT,
    passenger_details TEXT,
    
    from_location_type ENUM('country', 'city', 'airport') DEFAULT NULL,
    from_country VARCHAR(100),
    from_city VARCHAR(100),
    from_airport_options TEXT,
    
    to_location_type ENUM('country', 'city', 'airport') DEFAULT NULL,
    to_country VARCHAR(100),
    to_city VARCHAR(100),
    to_airport_options TEXT,
    
    temp_departure_date DATE,
    temp_return_date DATE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)");

// Create bookings table
$db->exec("CREATE TABLE IF NOT EXISTS ".$dbPrefix."bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    booking_reference VARCHAR(50) NOT NULL,
    flight_details TEXT NOT NULL,
    passenger_details TEXT NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending',
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(5) DEFAULT 'EUR',
    payment_intent VARCHAR(100),
    pay_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (phone_number),
    INDEX (booking_reference),
    INDEX (payment_status)
)");

// Helper Functions

function findAirportCode($cityName) {
    $airports = [
        'Ahmedabad' => 'AMD', 'Mumbai' => 'BOM', 'Delhi' => 'DEL',
        'Bengaluru' => 'BLR', 'Lebanon' => 'BEY', 'Beirut' => 'BEY',
        'Dubai' => 'DXB', 'Abu Dhabi' => 'AUH', 'Doha' => 'DOH'
    ];
    
    foreach ($airports as $city => $code) {
        if (stripos($city, $cityName) !== false || stripos($cityName, $city) !== false) {
            return $code;
        }
    }
    return null;
}

function getAmadeusAccessToken() {
    $url = 'https://test.api.amadeus.com/v1/security/oauth2/token';
    $data = [
        'grant_type' => 'client_credentials',
        'client_id' => $_ENV['AMADEUS_CLIENT_ID'],
        'client_secret' => $_ENV['AMADEUS_CLIENT_SECRET']
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $result = json_decode($response, true);
    return $result['access_token'] ?? null;
}

function getFlights($fromCode, $toCode, $date, $adults = 1) {
    $accessToken = getAmadeusAccessToken();
    if (!$accessToken) return ['error' => 'API authentication failed'];

    $url = "https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=$fromCode&destinationLocationCode=$toCode&departureDate=$date&adults=$adults&max=3";
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer $accessToken"]);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $result = json_decode($response, true);
    return $result['data'] ?? ['error' => 'No flights found'];
}

function detectLocationType($db, $input) {
    $input = trim($input);
    
    // Check for IATA code
    if (preg_match('/^[A-Z]{3}$/i', $input)) {
        $stmt = $db->prepare("SELECT iata_code, name, municipality, country_name 
                             FROM ".$dbPrefix."airports WHERE iata_code = ? LIMIT 1");
        $stmt->execute([strtoupper($input)]);
        if ($result = $stmt->fetch()) {
            return [
                'type' => 'airport',
                'code' => $result['iata_code'],
                'name' => $result['name'],
                'city' => $result['municipality'],
                'country' => $result['country_name']
            ];
        }
    }
    
    // Check for country match
    $stmt = $db->prepare("
        SELECT DISTINCT country_name,
            CASE 
                WHEN country_name = ? THEN 1 
                ELSE 2 
            END AS match_priority
        FROM ".$dbPrefix."airports
        WHERE country_name LIKE ?
        ORDER BY match_priority
        LIMIT 1
    ");
    $stmt->execute([$input, "%$input%"]);
    if ($country = $stmt->fetch()) {
        return [
            'type' => 'country',
            'name' => $country['country_name']
        ];
    }
    
    // Check for city with single airport
    $stmt = $db->prepare("SELECT iata_code, name, municipality, country_name 
                         FROM ".$dbPrefix."airports 
                         WHERE municipality LIKE ? 
                         GROUP BY municipality 
                         HAVING COUNT(*) = 1");
    $stmt->execute(["%$input%"]);
    if ($city = $stmt->fetch()) {
        return [
            'type' => 'city',
            'code' => $city['iata_code'],
            'name' => $city['municipality'],
            'country' => $city['country_name']
        ];
    }
    
    // Check for city with multiple airports
    $stmt = $db->prepare("SELECT municipality 
                         FROM ".$dbPrefix."airports 
                         WHERE municipality LIKE ? 
                         GROUP BY municipality 
                         HAVING COUNT(*) > 1");
    $stmt->execute(["%$input%"]);
    if ($city = $stmt->fetch()) {
        return [
            'type' => 'multi_city',
            'name' => $city['municipality']
        ];
    }
    
    // Check for airport name match
    $stmt = $db->prepare("SELECT iata_code, name, municipality, country_name 
                         FROM ".$dbPrefix."airports 
                         WHERE name LIKE ? 
                         LIMIT 1");
    $stmt->execute(["%$input%"]);
    if ($airport = $stmt->fetch()) {
        return [
            'type' => 'airport',
            'code' => $airport['iata_code'],
            'name' => $airport['name'],
            'city' => $airport['municipality'],
            'country' => $airport['country_name']
        ];
    }
    
    return ['type' => 'unknown'];
}

function sendWhatsAppMessage($phoneNumber, $message) {
    $url = "https://graph.facebook.com/v17.0/{$_ENV['WHATSAPP_PHONE_ID']}/messages";
    
    $data = [
        'messaging_product' => 'whatsapp',
        'to' => $phoneNumber,
        'type' => 'text',
        'text' => ['body' => $message]
    ];
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer {$_ENV['WHATSAPP_TOKEN']}",
        'Content-Type: application/json'
    ]);
    
    curl_exec($ch);
    curl_close($ch);
}

function sendInteractiveList($phoneNumber, $message, $sections) {
    $url = "https://graph.facebook.com/v17.0/{$_ENV['WHATSAPP_PHONE_ID']}/messages";
    
    $data = [
        'messaging_product' => 'whatsapp',
        'to' => $phoneNumber,
        'type' => 'interactive',
        'interactive' => [
            'type' => 'list',
            'body' => ['text' => $message],
            'action' => [
                'button' => 'Select Option',
                'sections' => $sections
            ]
        ]
    ];
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer {$_ENV['WHATSAPP_TOKEN']}",
        'Content-Type: application/json'
    ]);
    
    curl_exec($ch);
    curl_close($ch);
}

function sendPassengerDetailsTemplate($phoneNumber, $number, $type) {
    $template = "✈️ Please provide details for $type $number:\n\n";
    $template .= "Format:\n";
    $template .= "First Name: [Name]\n";
    $template .= "Last Name: [Name]\n";
    $template .= "Gender: Male/Female/Other\n";
    $template .= "Date of Birth: YYYY-MM-DD\n";
    $template .= "Passport Number: [Number]\n";
    $template .= "Passport Expiry: YYYY-MM-DD\n";
    $template .= "Nationality: [Country Code]\n";
    $template .= "Email: [email@example.com]\n";
    $template .= "Phone: [CountryCode][Number]\n\n";
    $template .= "Example:\n";
    $template .= "First Name: John\n";
    $template .= "Last Name: Doe\n";
    $template .= "Gender: Male\n";
    $template .= "Date of Birth: 1985-05-15\n";
    $template .= "Passport Number: P12345678\n";
    $template .= "Passport Expiry: 2030-01-01\n";
    $template .= "Nationality: LB\n";
    $template .= "Email: john@example.com\n";
    $template .= "Phone: 96170123456";

    sendWhatsAppMessage($phoneNumber, $template);
}

function parsePassengerDetails($text) {
    $details = [];
    $lines = explode("\n", $text);
    
    foreach ($lines as $line) {
        if (preg_match('/First Name:\s*(.+)/i', $line, $matches)) $details['firstName'] = trim($matches[1]);
        if (preg_match('/Last Name:\s*(.+)/i', $line, $matches)) $details['lastName'] = trim($matches[1]);
        if (preg_match('/Gender:\s*(Male|Female|Other)/i', $line, $matches)) $details['gender'] = ucfirst(strtolower(trim($matches[1])));
        if (preg_match('/Date of Birth:\s*(\d{4}-\d{2}-\d{2})/i', $line, $matches)) $details['dateOfBirth'] = trim($matches[1]);
        if (preg_match('/Passport Number:\s*(.+)/i', $line, $matches)) $details['passportNumber'] = trim($matches[1]);
        if (preg_match('/Passport Expiry:\s*(\d{4}-\d{2}-\d{2})/i', $line, $matches)) $details['passportExpiry'] = trim($matches[1]);
        if (preg_match('/Nationality:\s*([A-Za-z]{2})/i', $line, $matches)) $details['nationality'] = strtoupper(trim($matches[1]));
        if (preg_match('/Email:\s*(.+@.+\..+)/i', $line, $matches)) $details['email'] = trim($matches[1]);
        if (preg_match('/Phone:\s*(\d+)/i', $line, $matches)) $details['phone'] = trim($matches[1]);
    }
    
    return $details;
}

function validatePassengerDetails($details, $type) {
    $required = [
        'firstName' => 'First Name',
        'lastName' => 'Last Name',
        'gender' => 'Gender',
        'dateOfBirth' => 'Date of Birth',
        'passportNumber' => 'Passport Number',
        'passportExpiry' => 'Passport Expiry',
        'nationality' => 'Nationality',
        'email' => 'Email',
        'phone' => 'Phone'
    ];
    
    $missing = [];
    foreach ($required as $field => $name) {
        if (empty($details[$field])) {
            $missing[] = $name;
        }
    }
    
    if (!empty($missing)) {
        return [
            'valid' => false,
            'message' => "Missing required fields: " . implode(', ', $missing)
        ];
    }
    
    if (!validateDate($details['dateOfBirth'])) {
        return [
            'valid' => false,
            'message' => "Invalid Date of Birth format. Use YYYY-MM-DD"
        ];
    }
    
    if (!validateDate($details['passportExpiry'])) {
        return [
            'valid' => false,
            'message' => "Invalid Passport Expiry format. Use YYYY-MM-DD"
        ];
    }
    
    if (strtotime($details['passportExpiry']) < time()) {
        return [
            'valid' => false,
            'message' => "Passport must be valid (expiry date in future)"
        ];
    }
    
    if (!filter_var($details['email'], FILTER_VALIDATE_EMAIL)) {
        return [
            'valid' => false,
            'message' => "Invalid email format"
        ];
    }
    
    if (strlen($details['phone']) < 8) {
        return [
            'valid' => false,
            'message' => "Phone number too short"
        ];
    }
    
    if ($type === 'Child') {
        $dob = new DateTime($details['dateOfBirth']);
        $age = $dob->diff(new DateTime())->y;
        
        if ($age >= 12) {
            return [
                'valid' => false,
                'message' => "Child passenger must be under 12 years old"
            ];
        }
    }
    
    return ['valid' => true, 'message' => ''];
}

function validateDate($date, $format = 'Y-m-d') {
    $d = DateTime::createFromFormat($format, $date);
    return $d && $d->format($format) === $date;
}

function getConversationState($db, $phoneNumber) {
    $stmt = $db->prepare("SELECT * FROM ".$dbPrefix."conversations WHERE phone_number = ?");
    $stmt->execute([$phoneNumber]);
    $state = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$state) {
        $stmt = $db->prepare("INSERT INTO ".$dbPrefix."conversations (phone_number, step) VALUES (?, 'new')");
        $stmt->execute([$phoneNumber]);
        return ['phone_number' => $phoneNumber, 'step' => 'new'];
    }
    
    return $state;
}

function updateConversationState($db, $phoneNumber, $data) {
    $fields = array_keys($data);
    $setClause = implode(' = ?, ', $fields) . ' = ?';
    $values = array_values($data);
    $values[] = $phoneNumber;
    
    $stmt = $db->prepare("UPDATE ".$dbPrefix."conversations SET $setClause WHERE phone_number = ?");
    $stmt->execute($values);
}

// Main Webhook Logic

$input = file_get_contents('php://input');
file_put_contents('debug_input.txt', $input, FILE_APPEND);


if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $mode = $_GET['hub_mode'] ?? null;
    $token = $_GET['hub_verify_token'] ?? null;
    $challenge = $_GET['hub_challenge'] ?? null;

    if ($mode === 'subscribe' && $token === 'flightbot123') {
        echo $challenge;
    } else {
        http_response_code(403);
        echo 'Forbidden';
    }
    exit;
}


$data = json_decode($input, true);
if (empty($data['entry'][0]['changes'][0]['value']['messages'][0])) {
    http_response_code(200);
    exit;
}

$message = $data['entry'][0]['changes'][0]['value']['messages'][0];
$phoneNumber = $message['from'];

if (isset($message['text'])) {
    $text = $message['text']['body'];
} elseif (isset($message['interactive']['list_reply'])) {
    $interactive = $message['interactive']['list_reply']['id'];
} else {
    http_response_code(200);
    exit;
}

$state = getConversationState($db, $phoneNumber);

// Conversation Flow
if (strtolower($text ?? '') === 'hi' || $state['step'] === 'new') {
    updateConversationState($db, $phoneNumber, ['step' => 'awaiting_category']);
    sendInteractiveList($phoneNumber, 'Please choose a category:', [[
        'title' => 'Categories',
        'rows' => [
            ['id' => 'flights', 'title' => 'Flights'],
            ['id' => 'hotels', 'title' => 'Hotels']
        ]
    ]]);
}
elseif ($state['step'] === 'awaiting_category' && ($interactive ?? '') === 'flights') {
    updateConversationState($db, $phoneNumber, ['step' => 'awaiting_flight_details']);
    sendWhatsAppMessage($phoneNumber, 
        "🛫 Let's book your flight! Please provide:\n\n" .
        "1. Travel details:\n" .
        "Format: From [Location] To [Location] [DepartureDate]\n" .
        "Example: From Beirut To Dubai 2025-05-15\n\n" .
        "Need a return ticket? Include return date:\n" .
        "From [Location] To [Location] [DepartureDate] [ReturnDate]\n" .
        "Example: From Beirut To Dubai 2025-05-15 2025-05-20"
    );
}
elseif ($state['step'] === 'awaiting_flight_details' && isset($text)) {
    if (preg_match('/from (.+?) to (.+?) (\d{4}-\d{2}-\d{2})(?:\s+(\d{4}-\d{2}-\d{2}))?/i', $text, $matches)) {

        $fromLocation = trim($matches[1]);
        $toLocation = trim($matches[2]);
        $departureDate = trim($matches[3]);
        $returnDate = isset($matches[4]) ? trim($matches[4]) : null;
        
        $fromAnalysis = detectLocationType($db, $fromLocation);
        $toAnalysis = detectLocationType($db, $toLocation);
        
        // Store temporary dates
        updateConversationState($db, $phoneNumber, [
            'temp_departure_date' => $departureDate,
            'temp_return_date' => $returnDate
        ]);
        
        if ($toAnalysis['type'] === 'country') {
            updateConversationState($db, $phoneNumber, [
                'to_location_type' => 'country',
                'to_country' => $matches[2],
            ]);
        }
        elseif ($toAnalysis['type'] === 'multi_city') {
            updateConversationState($db, $phoneNumber, [
                'to_location_type' => 'city',
                'to_city' => $matches[2],
            ]);
        }
        elseif ($toAnalysis['type'] === 'city') {
            updateConversationState($db, $phoneNumber, [
                'to_location_type' => 'city',
                'to_city' => $matches[2],
            ]);
        }
        elseif ($toAnalysis['type'] === 'airport') {
            updateConversationState($db, $phoneNumber, [
                'to_location_type' => 'airport',
                'to_city' => $matches[2],
            ]);
        }


        // Handle FROM location
        if ($fromAnalysis['type'] === 'country') {
            updateConversationState($db, $phoneNumber, [
                'step' => 'awaiting_from_city',
                'from_location_type' => 'country',
                'from_country' => $fromAnalysis['name'],
                'from_city' => null,
                'from_airport_options' => null
            ]);
            sendWhatsAppMessage($phoneNumber, 
                "Please specify a city in {$fromAnalysis['name']} for departure:"
            );
        }
        elseif ($fromAnalysis['type'] === 'multi_city') {
            $stmt = $db->prepare("SELECT iata_code, name FROM ".$dbPrefix."airports WHERE municipality = ?");
            $stmt->execute([$fromAnalysis['name']]);
            $airports = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $options = [];
            foreach ($airports as $airport) {
                $options[] = [
                    'id' => 'from_'.$airport['iata_code'],
                    'title' => "{$airport['name']} ({$airport['iata_code']})"
                ];
            }
            
            updateConversationState($db, $phoneNumber, [
                'step' => 'awaiting_from_airport',
                'from_location_type' => 'city',
                'from_city' => $fromAnalysis['name'],
                'from_airport_options' => json_encode($options)
            ]);
            sendInteractiveList($phoneNumber, 
                "Select departure airport in {$fromAnalysis['name']}:",
                [['title' => 'Airports', 'rows' => $options]]
            );
        }
        elseif ($fromAnalysis['type'] === 'city') {
            $fromCode = $fromAnalysis['code'];
            $fromName = $fromAnalysis['name'];
            
            updateConversationState($db, $phoneNumber, [
                'from_code' => $fromCode,
                'from_name' => $fromName,
                'from_location_type' => 'city',
                'from_city' => $fromName
            ]);
            
            // Proceed to handle TO location
            handleToLocation($db, $phoneNumber, $toLocation, $fromCode, $fromName, $departureDate, $returnDate);
        }
        elseif ($fromAnalysis['type'] === 'airport') {
            $fromCode = $fromAnalysis['code'];
            $fromName = $fromAnalysis['name'];
            
            updateConversationState($db, $phoneNumber, [
                'from_code' => $fromCode,
                'from_name' => $fromName,
                'from_location_type' => 'airport'
            ]);
            
            // Proceed to handle TO location
            handleToLocation($db, $phoneNumber, $toLocation, $fromCode, $fromName, $departureDate, $returnDate);
        }
        else {
            sendWhatsAppMessage($phoneNumber, 
                "⚠️ Couldn't identify departure location. Please try again."
            );
        }
    } else {
        sendWhatsAppMessage($phoneNumber, 
            "❌ Invalid format. Please use:\n" .
            "From [Location] To [Location] [YYYY-MM-DD] for one-way\n" .
            "or\n" .
            "From [Location] To [Location] [YYYY-MM-DD] [YYYY-MM-DD] for round-trip"
        );
    }
}
elseif ($state['step'] === 'awaiting_from_city' && isset($text)) {
    $cityName = $text;
    
    $stmt = $db->prepare("SELECT iata_code, name, municipality 
                         FROM ".$dbPrefix."airports 
                         WHERE (municipality LIKE ? OR name LIKE ?) 
                         AND country_name = ?");
    $stmt->execute(["%$cityName%", "%$cityName%", $state['from_country']]);
    $airports = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (count($airports) === 1) {
        $fromCode = $airports[0]['iata_code'];
        $fromName = $airports[0]['municipality'] ?? $airports[0]['name'];
        
        updateConversationState($db, $phoneNumber, [
            'step' => 'awaiting_to_location',
            'from_code' => $fromCode,
            'from_name' => $fromName,
            'from_city' => $cityName
        ]);
        
        // Get the original TO location from the message
        preg_match('/from (.+?) to (.+?) (\d{4}-\d{2}-\d{2})(?:\s+(\d{4}-\d{2}-\d{2}))?/i', $state['temp_message'] ?? '', $matches);
        $toLocation = $matches[2] ?? '';
        
        handleToLocation($db, $phoneNumber, $toLocation, $fromCode, $fromName, 
                       $state['temp_departure_date'], $state['temp_return_date']);
    } 
    elseif (count($airports) > 1) {
        $options = [];
        foreach ($airports as $airport) {
            $displayName = $airport['municipality'] ? 
                "{$airport['municipality']} ({$airport['name']})" : 
                $airport['name'];
            if (strlen($displayName) > 24) {
                $displayName = substr($displayName, 0, 21) . '...';
            }
            $options[] = [
                'id' => 'from_'.$airport['iata_code'],
                'title' => $displayName
            ];
        }
        
        updateConversationState($db, $phoneNumber, [
            'step' => 'awaiting_from_airport',
            'from_city' => $cityName,
            'from_airport_options' => json_encode($options)
        ]);

        sendInteractiveList($phoneNumber, 
            "Select departure airport in $cityName, {$state['from_country']}:",
            [['title' => 'Airports', 'rows' => $options]]
        );
    } 
    else {
        sendWhatsAppMessage($phoneNumber, 
            "⚠️ No airports found in $cityName, {$state['from_country']}\n" .
            "Please try another city or enter airport code directly"
        );
    }
}
elseif ($state['step'] === 'awaiting_from_airport' && isset($interactive)) {
    $iataCode = str_replace('from_', '', $interactive);
    
    $stmt = $db->prepare("SELECT name, municipality FROM ".$dbPrefix."airports WHERE iata_code = ?");
    $stmt->execute([$iataCode]);
    $airport = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($airport) {
        $fromCode = $iataCode;
        $fromName = $airport['municipality'] ?? $airport['name'];
        
        updateConversationState($db, $phoneNumber, [
            'from_code' => $fromCode,
            'from_name' => $fromName
        ]);
        
        // Get the original TO location from the message
        preg_match('/from (.+?) to (.+?) (\d{4}-\d{2}-\d{2})(?:\s+(\d{4}-\d{2}-\d{2}))?/i', $state['temp_message'] ?? '', $matches);
        $toLocation = $matches[2] ?? '';
        
        handleToLocation($db, $phoneNumber, $toLocation, $fromCode, $fromName, 
                       $state['temp_departure_date'], $state['temp_return_date']);
    } else {
        sendWhatsAppMessage($phoneNumber, "⚠️ Airport not found. Please try again.");
    }
}elseif ($state['step'] === 'awaiting_to_airport' && isset($interactive)) {
    $iataCode = str_replace('to_', '', $interactive);
    
    $stmt = $db->prepare("SELECT name, municipality FROM ".$dbPrefix."airports WHERE iata_code = ?");
    $stmt->execute([$iataCode]);
    $airport = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($airport) {
        $toCode = $iataCode;
        $toName = $airport['municipality'] ?? $airport['name'];
        
        updateConversationState($db, $phoneNumber, [
            'step' => 'awaiting_passengers',
            'to_code' => $toCode,
            'to_name' => $toName,
            
        ]);

        $stmt = $db->prepare("SELECT * FROM ".$dbPrefix."conversations WHERE phone_number = ?");
        $stmt->execute([$phoneNumber]);
        $latest_state = $stmt->fetch(PDO::FETCH_ASSOC);

        $fromName=$latest_state['from_name'];
        $fromCode=$latest_state['from_code'];
        $toName=$latest_state['to_name'];
        $toCode=$latest_state['to_code'];
        $departureDate=$latest_state['departure_date'];
        $returnDate=$latest_state['return_date'];

        sendWhatsAppMessage($phoneNumber, 
            "✈️ Flight from $fromName ($fromCode) to $toName ($toCode) on $departureDate\n" .
            ($returnDate ? "Returning on $returnDate\n" : "") .
            "\nNow, how many passengers?\n" .
            "Format: Adults:X Children:Y\n" .
            "Example: Adults:2 Children:1"
        );

        // // Get the original TO location from the message
        // preg_match('/from (.+?) to (.+?) (\d{4}-\d{2}-\d{2})(?:\s+(\d{4}-\d{2}-\d{2}))?/i', $state['temp_message'] ?? '', $matches);
        // $toLocation = $matches[2] ?? '';
        
        // handleToLocation($db, $phoneNumber, $toLocation, $fromCode, $fromName, 
        //                $state['temp_departure_date'], $state['temp_return_date']);
    } else {
        sendWhatsAppMessage($phoneNumber, "⚠️ Airport not found. Please try again.");
    }
}
elseif ($state['step'] === 'awaiting_passengers' && isset($text)) {
    if (preg_match('/adults:\s*(\d+)\s*children:\s*(\d+)/i', $text, $matches)) {
        $adults = (int)$matches[1];
        $children = (int)$matches[2];
        
        // Validate passenger counts
        if ($adults < 1) {
            sendWhatsAppMessage($phoneNumber, "❌ At least 1 adult is required. Please specify again.");
            return;
        }
        
        if ($adults + $children > 9) {
            sendWhatsAppMessage($phoneNumber, "❌ Maximum 9 passengers allowed. Please specify again.");
            return;
        }

        // Get departure flights
        $departureFlights = getFlights(
            $state['from_code'], 
            $state['to_code'], 
            $state['departure_date'],
            $adults
        );

        if (isset($departureFlights['error']) || empty($departureFlights)) {
            sendWhatsAppMessage($phoneNumber, "❌ No flights found for your criteria");
            return;
        }

        // Get return flights if needed
        $returnFlights = [];
        if ($state['needs_return']) {
            $returnFlights = getFlights(
                $state['to_code'],
                $state['from_code'],
                $state['return_date'],
                $adults
            );
        }

        updateConversationState($db, $phoneNumber, [
            'step' => 'awaiting_flight_selection',
            'adults' => $adults,
            'children' => $children,
            'departure_flights' => json_encode($departureFlights),
            'return_flights' => json_encode($returnFlights)
        ]);

        // Show departure flights
        $response = "✈️ Available departure flights for {$state['departure_date']}:\n\n";
        foreach ($departureFlights as $i => $flight) {
            $seg = $flight['itineraries'][0]['segments'][0];
            $response .= ($i+1).". {$seg['carrierCode']}{$seg['flightNumber']}\n";
            $response .= "   🛫 {$seg['departure']['iataCode']} ".date('M d, H:i', strtotime($seg['departure']['at']))."\n";
            $response .= "   🛬 {$seg['arrival']['iataCode']} ".date('M d, H:i', strtotime($seg['arrival']['at']))."\n";
            $response .= "   💰 {$flight['price']['total']} {$flight['price']['currency']}\n\n";
        }

        if ($state['needs_return']) {
            $response .= "\nReturn date: {$state['return_date']} - We'll show return options after you select departure flight.";
        }

        sendWhatsAppMessage($phoneNumber, $response."Reply with the departure flight number (1, 2, or 3)");
    } else {
        sendWhatsAppMessage($phoneNumber, 
            "❌ Invalid format. Please use:\n" .
            "Adults:X Children:Y\n" .
            "Example: Adults:2 Children:1"
        );
    }
}
elseif ($state['step'] === 'awaiting_flight_selection' && isset($text) && preg_match('/^[1-3]$/', $text)) {
    $departureFlights = json_decode($state['departure_flights'], true);
    $flightIndex = (int)$text - 1;
    
    if (!isset($departureFlights[$flightIndex])) {
        sendWhatsAppMessage($phoneNumber, "❌ Invalid selection. Please try again.");
        return;
    }

    $selectedDeparture = $departureFlights[$flightIndex];
    
    // If return needed, show return options
    if ($state['needs_return']) {
        $returnFlights = json_decode($state['return_flights'], true);
        
        if (empty($returnFlights)) {
            sendWhatsAppMessage($phoneNumber, "❌ No return flights found for {$state['return_date']}");
            return;
        }

        updateConversationState($db, $phoneNumber, [
            'step' => 'awaiting_return_selection',
            'selected_departure' => json_encode($selectedDeparture)
        ]);

        $response = "✈️ Available return flights for {$state['return_date']}:\n\n";
        foreach ($returnFlights as $i => $flight) {
            $seg = $flight['itineraries'][0]['segments'][0];
            $response .= ($i+1).". {$seg['carrierCode']}{$seg['flightNumber']}\n";
            $response .= "   🛫 {$seg['departure']['iataCode']} ".date('M d, H:i', strtotime($seg['departure']['at']))."\n";
            $response .= "   🛬 {$seg['arrival']['iataCode']} ".date('M d, H:i', strtotime($seg['arrival']['at']))."\n";
            $response .= "   💰 {$flight['price']['total']} {$flight['price']['currency']}\n\n";
        }

        sendWhatsAppMessage($phoneNumber, $response."Reply with the return flight number (1, 2, or 3)");
    } else {
        // No return needed, proceed to confirmation
        $totalPrice = $selectedDeparture['price']['total'] * ($state['adults'] + $state['children'] * 0.8);
        
        updateConversationState($db, $phoneNumber, [
            'step' => 'awaiting_confirmation',
            'selected_departure' => json_encode($selectedDeparture),
            'selected_return' => null
        ]);

        $confirmationMessage = "✅ Please confirm your one-way booking:\n\n";
        $confirmationMessage .= "✈️ Flight Details:\n";
        $confirmationMessage .= "Flight: {$selectedDeparture['itineraries'][0]['segments'][0]['carrierCode']}{$selectedDeparture['itineraries'][0]['segments'][0]['flightNumber']}\n";
        $confirmationMessage .= "From: {$selectedDeparture['itineraries'][0]['segments'][0]['departure']['iataCode']}\n";
        $confirmationMessage .= "To: {$selectedDeparture['itineraries'][0]['segments'][0]['arrival']['iataCode']}\n";
        $confirmationMessage .= "Date: ".date('M d, Y H:i', strtotime($selectedDeparture['itineraries'][0]['segments'][0]['departure']['at']))."\n";
        $confirmationMessage .= "\n👥 Passengers:\n";
        $confirmationMessage .= "Adults: {$state['adults']}, Children: {$state['children']}\n";
        $confirmationMessage .= "\n💰 Total Price: ".number_format($totalPrice, 2)." {$selectedDeparture['price']['currency']}\n\n";
        $confirmationMessage .= "Type 'CONFIRM' to proceed with booking";

        sendWhatsAppMessage($phoneNumber, $confirmationMessage);
    }
}
elseif ($state['step'] === 'awaiting_return_selection' && isset($text) && preg_match('/^[1-3]$/', $text)) {
    $returnFlights = json_decode($state['return_flights'], true);
    $flightIndex = (int)$text - 1;
    
    if (!isset($returnFlights[$flightIndex])) {
        sendWhatsAppMessage($phoneNumber, "❌ Invalid selection. Please try again.");
        return;
    }

    $selectedReturn = $returnFlights[$flightIndex];
    $selectedDeparture = json_decode($state['selected_departure'], true);
    
    $totalPrice = ($selectedDeparture['price']['total'] + $selectedReturn['price']['total']) * 
                 ($state['adults'] + $state['children'] * 0.8);
    
    updateConversationState($db, $phoneNumber, [
        'step' => 'awaiting_confirmation',
        'selected_return' => json_encode($selectedReturn)
    ]);

    $confirmationMessage = "✅ Please confirm your round-trip booking:\n\n";
    $confirmationMessage .= "✈️ Departure Flight:\n";
    $confirmationMessage .= "Flight: {$selectedDeparture['itineraries'][0]['segments'][0]['carrierCode']}{$selectedDeparture['itineraries'][0]['segments'][0]['flightNumber']}\n";
    $confirmationMessage .= "From: {$selectedDeparture['itineraries'][0]['segments'][0]['departure']['iataCode']}\n";
    $confirmationMessage .= "To: {$selectedDeparture['itineraries'][0]['segments'][0]['arrival']['iataCode']}\n";
    $confirmationMessage .= "Date: ".date('M d, Y H:i', strtotime($selectedDeparture['itineraries'][0]['segments'][0]['departure']['at']))."\n\n";
    
    $confirmationMessage .= "✈️ Return Flight:\n";
    $confirmationMessage .= "Flight: {$selectedReturn['itineraries'][0]['segments'][0]['carrierCode']}{$selectedReturn['itineraries'][0]['segments'][0]['flightNumber']}\n";
    $confirmationMessage .= "From: {$selectedReturn['itineraries'][0]['segments'][0]['departure']['iataCode']}\n";
    $confirmationMessage .= "To: {$selectedReturn['itineraries'][0]['segments'][0]['arrival']['iataCode']}\n";
    $confirmationMessage .= "Date: ".date('M d, Y H:i', strtotime($selectedReturn['itineraries'][0]['segments'][0]['departure']['at']))."\n";
    
    $confirmationMessage .= "\n👥 Passengers:\n";
    $confirmationMessage .= "Adults: {$state['adults']}, Children: {$state['children']}\n";
    $confirmationMessage .= "\n💰 Total Price: ".number_format($totalPrice, 2)." {$selectedDeparture['price']['currency']}\n\n";
    $confirmationMessage .= "Type 'CONFIRM' to proceed with booking";

    sendWhatsAppMessage($phoneNumber, $confirmationMessage);
}
elseif ($state['step'] === 'awaiting_confirmation' && isset($text) && strtoupper($text) === 'CONFIRM') {
    $bookingRef = 'BOOK-' . strtoupper(substr(md5(uniqid()), 0, 6));
    $selectedDeparture = json_decode($state['selected_departure'], true);
    $selectedReturn = $state['selected_return'] ? json_decode($state['selected_return'], true) : null;
    
    $totalPrice = $selectedDeparture['price']['total'] * ($state['adults'] + $state['children'] * 0.8);
    if ($selectedReturn) {
        $totalPrice += $selectedReturn['price']['total'] * ($state['adults'] + $state['children'] * 0.8);
    }

    // Save booking to database
    $flightDetails = [
        'departure' => $selectedDeparture,
        'return' => $selectedReturn
    ];
    
    $stmt = $db->prepare("INSERT INTO ".$dbPrefix."bookings (phone_number, booking_reference, flight_details, payment_status, amount, currency) 
                          VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $phoneNumber,
        $bookingRef,
        json_encode($flightDetails),
        'pending',
        $totalPrice,
        $selectedDeparture['price']['currency']
    ]);

    sendWhatsAppMessage($phoneNumber, 
        "🎉 Booking confirmed!\n" .
        "Booking Reference: $bookingRef\n" .
        "Total Amount: ".number_format($totalPrice, 2)." {$selectedDeparture['price']['currency']}\n\n" .
        "We'll now collect passenger details. Please wait for the next message..."
    );
    
    // Move to passenger details collection
    updateConversationState($db, $phoneNumber, [
        'step' => 'collecting_adult_1',
        'passenger_details' => json_encode([
            'adults' => $state['adults'],
            'children' => $state['children'],
            'passengers' => []
        ])
    ]);
    
    // Send first passenger details request
    sendPassengerDetailsTemplate($phoneNumber, 1, 'Adult');
}
elseif (str_starts_with($state['step'], 'collecting_') && isset($text)) {
    $passengerType = str_contains($state['step'], 'adult') ? 'Adult' : 'Child';
    $passengerNumber = (int)substr($state['step'], strrpos($state['step'], '_') + 1);
    $passengerDetails = json_decode($state['passenger_details'], true);

    // Parse the received details
    $details = parsePassengerDetails($text);
    
    // Validate required fields
    $validation = validatePassengerDetails($details, $passengerType);
    if (!$validation['valid']) {
        sendWhatsAppMessage($phoneNumber, "❌ Invalid details:\n".$validation['message']);
        sendPassengerDetailsTemplate($phoneNumber, $passengerNumber, $passengerType);
        return;
    }

    // Add to passenger list
    $passengerDetails['passengers'][] = [
        'type' => $passengerType,
        'number' => $passengerNumber,
        'firstName' => $details['firstName'],
        'lastName' => $details['lastName'],
        'gender' => $details['gender'],
        'dateOfBirth' => $details['dateOfBirth'],
        'passportNumber' => $details['passportNumber'],
        'passportExpiry' => $details['passportExpiry'],
        'nationality' => $details['nationality'],
        'email' => $details['email'],
        'phone' => $details['phone']
    ];

    // Check if we have more passengers to collect
    $totalPassengers = $passengerDetails['adults'] + $passengerDetails['children'];
    $collectedPassengers = count($passengerDetails['passengers']);

    if ($collectedPassengers < $totalPassengers) {
        $nextPassengerNumber = $collectedPassengers + 1;
        $nextPassengerType = ($collectedPassengers < $passengerDetails['adults']) ? 'Adult' : 'Child';

        updateConversationState($db, $phoneNumber, [
            'step' => 'collecting_' . strtolower($nextPassengerType) . '_' . $nextPassengerNumber,
            'passenger_details' => json_encode($passengerDetails)
        ]);

        sendPassengerDetailsTemplate($phoneNumber, $nextPassengerNumber, $nextPassengerType);
    } else {
        // All passengers collected, update booking with passenger details
        $stmt = $db->prepare("UPDATE ".$dbPrefix."bookings SET passenger_details = ? WHERE phone_number = ? ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([json_encode($passengerDetails), $phoneNumber]);
        

        // First get the latest booking reference for this phone number
        $stmt = $db->prepare("SELECT booking_reference FROM ".$dbPrefix."bookings WHERE phone_number = ? ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([$phoneNumber]);
        $booking = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($booking && !empty($booking['booking_reference'])) {
            $bookingRef = $booking['booking_reference'];

            // Generate payment link (in a real implementation)
            $paymentLink = $_ENV['BOOKING_BASE_URL']."?booking_ref=$bookingRef";
            
            sendWhatsAppMessage($phoneNumber, 
                "✅ All passenger details received!\n\n" .
                "Please complete your payment here:\n" .
                "$paymentLink\n\n" .
                "Once payment is confirmed, we'll issue your tickets."
            );
        }else {
            sendWhatsAppMessage($phoneNumber, 
                "❌ Error: Could not generate payment link. Please contact support."
            );
        }
        
        
        // Reset conversation
        $db->prepare("DELETE FROM ".$dbPrefix."conversations WHERE phone_number = ?")->execute([$phoneNumber]);
    }
}

// Handle TO location processing
function handleToLocation($db, $phoneNumber, $toLocation, $fromCode, $fromName, $departureDate, $returnDate) {

    if($toLocation == ''){
        $stmt = $db->prepare("SELECT * FROM ".$dbPrefix."conversations WHERE phone_number = ? ORDER BY phone_number DESC LIMIT 1");
        $stmt->execute([$phoneNumber]);
        $lastConversation = $stmt->fetch(PDO::FETCH_ASSOC);

        if( $lastConversation['to_location_type'] == 'country'){
            $toLocation = $lastConversation['to_country'];
        }
        if( $lastConversation['to_location_type'] == 'city'){
            $toLocation = $lastConversation['to_city'];
        }
        if( $lastConversation['to_location_type'] == 'airport'){
            $toLocation = $lastConversation['to_city'];
        }
    }
        



    $toAnalysis = detectLocationType($db, $toLocation);
    
    if ($toAnalysis['type'] === 'country') {
        updateConversationState($db, $phoneNumber, [
            'step' => 'awaiting_to_city',
            'to_location_type' => 'country',
            'to_country' => $toAnalysis['name'],
            'to_city' => null,
            'to_airport_options' => null,
            'from_code' => $fromCode,
            'from_name' => $fromName,
            'departure_date' => $departureDate,
            'needs_return' => $returnDate ? 1 : 0,
            'return_date' => $returnDate
        ]);
        sendWhatsAppMessage($phoneNumber, 
            "Please specify a city in {$toAnalysis['name']} for arrival:"
        );
    }
    elseif ($toAnalysis['type'] === 'multi_city') {
        $stmt = $db->prepare("SELECT iata_code, name FROM ".$dbPrefix."airports WHERE municipality = ?");
        $stmt->execute([$toAnalysis['name']]);
        $airports = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $options = [];
        foreach ($airports as $airport) {
            // $options[] = [
            //     'id' => 'to_'.$airport['iata_code'],
            //     'title' => "{$airport['name']} ({$airport['iata_code']})"
            // ];
            
            $name = "{$airport['name']} ({$airport['iata_code']})";
            $shortName = (strlen($name) > 24) ? substr($name, 0, 21) . '...' : $name;
            $options[] = [
                'id' => 'to_' . $airport['iata_code'],
                'title' => $shortName
            ];

        }
        
        updateConversationState($db, $phoneNumber, [
            'step' => 'awaiting_to_airport',
            'to_location_type' => 'city',
            'to_city' => $toAnalysis['name'],
            'to_airport_options' => json_encode($options),
            'from_code' => $fromCode,
            'from_name' => $fromName,
            'departure_date' => $departureDate,
            'needs_return' => $returnDate ? 1 : 0,
            'return_date' => $returnDate
        ]);
        sendInteractiveList($phoneNumber, 
            "Select arrival airport in {$toAnalysis['name']}:",
            [['title' => 'Airports', 'rows' => $options]]
        );
    }
    elseif ($toAnalysis['type'] === 'city') {
        $toCode = $toAnalysis['code'];
        $toName = $toAnalysis['name'];
        
        updateConversationState($db, $phoneNumber, [
            'step' => 'awaiting_passengers',
            'to_code' => $toCode,
            'to_name' => $toName,
            'to_location_type' => 'city',
            'to_city' => $toName,
            'from_code' => $fromCode,
            'from_name' => $fromName,
            'departure_date' => $departureDate,
            'needs_return' => $returnDate ? 1 : 0,
            'return_date' => $returnDate
        ]);
        sendWhatsAppMessage($phoneNumber, 
            "✈️ Flight from $fromName ($fromCode) to $toName ($toCode) on $departureDate\n" .
            ($returnDate ? "Returning on $returnDate\n" : "") .
            "\nNow, how many passengers?\n" .
            "Format: Adults:X Children:Y\n" .
            "Example: Adults:2 Children:1"
        );
    }
    elseif ($toAnalysis['type'] === 'airport') {
        $toCode = $toAnalysis['code'];
        $toName = $toAnalysis['name'];
        
        updateConversationState($db, $phoneNumber, [
            'step' => 'awaiting_passengers',
            'to_code' => $toCode,
            'to_name' => $toName,
            'to_location_type' => 'airport',
            'from_code' => $fromCode,
            'from_name' => $fromName,
            'departure_date' => $departureDate,
            'needs_return' => $returnDate ? 1 : 0,
            'return_date' => $returnDate
        ]);
        sendWhatsAppMessage($phoneNumber, 
            "✈️ Flight from $fromName ($fromCode) to $toName ($toCode) on $departureDate\n" .
            ($returnDate ? "Returning on $returnDate\n" : "") .
            "\nNow, how many passengers?\n" .
            "Format: Adults:X Children:Y\n" .
            "Example: Adults:2 Children:1"
        );
    }
    else {
        sendWhatsAppMessage($phoneNumber, 
            "⚠️ Couldn't identify arrival location. Please try again."
        );
    }
}

// [Rest of your existing code for passenger handling, flight selection, etc.]

http_response_code(200);