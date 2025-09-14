const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const { pool, dbPrefix } = require('../config/db');
require('dotenv').config();

// Create tables
async function createTables() {
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS ${dbPrefix}conversations (
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
        )
    `);

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS ${dbPrefix}bookings (
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
        )
    `);
}

// Helper Functions

function findAirportCode(cityName) {
    const airports = {
        'Ahmedabad': 'AMD', 'Mumbai': 'BOM', 'Delhi': 'DEL',
        'Bengaluru': 'BLR', 'Lebanon': 'BEY', 'Beirut': 'BEY',
        'Dubai': 'DXB', 'Abu Dhabi': 'AUH', 'Doha': 'DOH'
    };

    for (let [city, code] of Object.entries(airports)) {
        if (city.toLowerCase().includes(cityName.toLowerCase()) || 
            cityName.toLowerCase().includes(city.toLowerCase())) {
            return code;
        }
    }
    return null;
}

async function getAmadeusAccessToken() {
    try {
        const response = await axios.post('https://test.api.amadeus.com/v1/security/oauth2/token', 
            new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: process.env.AMADEUS_CLIENT_ID,
                client_secret: process.env.AMADEUS_CLIENT_SECRET
            }), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
        return response.data.access_token;
    } catch (error) {
        console.error('Amadeus token error:', error.message);
        return null;
    }
}

async function getFlights(fromCode, toCode, date, adults = 1) {
    const accessToken = await getAmadeusAccessToken();
    if (!accessToken) return { error: 'API authentication failed' };

    try {
        const response = await axios.get(
            `https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${fromCode}&destinationLocationCode=${toCode}&departureDate=${date}&adults=${adults}&max=3`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        return response.data.data || { error: 'No flights found' };
    } catch (error) {
        console.error('Flight search error:', error.message);
        return { error: 'No flights found' };
    }
}

async function detectLocationType(input) {
    input = input.trim();

    // Check for IATA code
    if (/^[A-Z]{3}$/i.test(input)) {
        const [rows] = await pool.execute(
            `SELECT iata_code, name, municipality, country_name FROM ${dbPrefix}airports WHERE iata_code = ? LIMIT 1`,
            [input.toUpperCase()]
        );
        if (rows.length) {
            return {
                type: 'airport',
                code: rows[0].iata_code,
                name: rows[0].name,
                city: rows[0].municipality,
                country: rows[0].country_name
            };
        }
    }

    // Check for country match
    const [countryRows] = await pool.execute(`
        SELECT DISTINCT country_name,
            CASE 
                WHEN country_name = ? THEN 1 
                ELSE 2 
            END AS match_priority
        FROM ${dbPrefix}airports
        WHERE country_name LIKE ?
        ORDER BY match_priority
        LIMIT 1
    `, [input, `%${input}%`]);
    if (countryRows.length) {
        return {
            type: 'country',
            name: countryRows[0].country_name
        };
    }

    // Check for city with single airport
    const [cityRows] = await pool.execute(
        `SELECT iata_code, name, municipality, country_name FROM ${dbPrefix}airports WHERE municipality LIKE ? GROUP BY municipality HAVING COUNT(*) = 1`,
        [`%${input}%`]
    );
    if (cityRows.length) {
        return {
            type: 'city',
            code: cityRows[0].iata_code,
            name: cityRows[0].municipality,
            country: cityRows[0].country_name
        };
    }

    // Check for city with multiple airports
    const [multiCityRows] = await pool.execute(
        `SELECT municipality FROM ${dbPrefix}airports WHERE municipality LIKE ? GROUP BY municipality HAVING COUNT(*) > 1`,
        [`%${input}%`]
    );
    if (multiCityRows.length) {
        return {
            type: 'multi_city',
            name: multiCityRows[0].municipality
        };
    }

    // Check for airport name match
    const [airportRows] = await pool.execute(
        `SELECT iata_code, name, municipality, country_name FROM ${dbPrefix}airports WHERE name LIKE ? LIMIT 1`,
        [`%${input}%`]
    );
    if (airportRows.length) {
        return {
            type: 'airport',
            code: airportRows[0].iata_code,
            name: airportRows[0].name,
            city: airportRows[0].municipality,
            country: airportRows[0].country_name
        };
    }

    return { type: 'unknown' };
}

async function sendWhatsAppMessage(phoneNumber, message) {

     // const errorArray = [
     //            { key: 'phoneNumber', value: process.env.WHATSAPP_PHONE_ID },
     //            { key: 'message', value: process.env.WHATSAPP_TOKEN },
                
     //        ];
     //        console.error(errorArray);
     //        await fs.appendFile(
     //            'error_log.txt',
     //            JSON.stringify(errorArray) + '\n'
     //        );
    try {
        await axios.post(
            `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                to: phoneNumber,
                type: 'text',
                text: { body: message }
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
    } catch (error) {
        console.error('WhatsApp message error:', error.message);
    }
}

async function sendInteractiveList(phoneNumber, message, sections) {
     // const errorArray = [
     //            { key: 'phoneNumber', value: process.env.WHATSAPP_PHONE_ID },
     //            { key: 'message', value: process.env.WHATSAPP_TOKEN },
                
     //        ];
     //        console.error(errorArray);
     //        await fs.appendFile(
     //            'error_log.txt',
     //            JSON.stringify(errorArray) + '\n'
     //        );

    try {
        await axios.post(
            `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                to: phoneNumber,
                type: 'interactive',
                interactive: {
                    type: 'list',
                    body: { text: message },
                    action: {
                        button: 'Select Option',
                        sections
                    }
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        await fs.appendFile('error_log.txt', JSON.stringify({
            message: 'sucess',
        }) + '\n');
    } catch (error) {
            const errorArray = [
                { key: 'error', value: 'WhatsApp interactive list error' },
                { key: 'message', value: error.message },
                { key: 'stack', value: error.stack },
                { key: 'response', value: error.response?.data || null },

                { key: 'phoneNumber', value: phoneNumber },
                { key: 'message', value: message },
                { key: 'sections', value: sections },
            ];

            console.error(errorArray);

            // await fs.appendFile(
            //     'error_log.txt',
            //     JSON.stringify(errorArray) + '\n'
            // );

    }
}

function sendPassengerDetailsTemplate(phoneNumber, number, type) {
    const template = `✈️ Please provide details for ${type} ${number}:\n\n` +
        `Format:\n` +
        `First Name: [Name]\n` +
        `Last Name: [Name]\n` +
        `Gender: Male/Female/Other\n` +
        `Date of Birth: YYYY-MM-DD\n` +
        `Passport Number: [Number]\n` +
        `Passport Expiry: YYYY-MM-DD\n` +
        `Nationality: [Country Code]\n` +
        `Email: [email@example.com]\n` +
        `Phone: [CountryCode][Number]\n\n` +
        `Example:\n` +
        `First Name: John\n` +
        `Last Name: Doe\n` +
        `Gender: Male\n` +
        `Date of Birth: 1985-05-15\n` +
        `Passport Number: P12345678\n` +
        `Passport Expiry: 2030-01-01\n` +
        `Nationality: LB\n` +
        `Email: john@example.com\n` +
        `Phone: 96170123456`;

    return sendWhatsAppMessage(phoneNumber, template);
}

function parsePassengerDetails(text) {
    const details = {};
    const lines = text.split('\n');

    for (let line of lines) {
        if (/First Name:\s*(.+)/i.test(line)) details.firstName = RegExp.$1.trim();
        if (/Last Name:\s*(.+)/i.test(line)) details.lastName = RegExp.$1.trim();
        if (/Gender:\s*(Male|Female|Other)/i.test(line)) details.gender = RegExp.$1.trim().toLowerCase().replace(/^\w/, c => c.toUpperCase());
        if (/Date of Birth:\s*(\d{4}-\d{2}-\d{2})/i.test(line)) details.dateOfBirth = RegExp.$1.trim();
        if (/Passport Number:\s*(.+)/i.test(line)) details.passportNumber = RegExp.$1.trim();
        if (/Passport Expiry:\s*(\d{4}-\d{2}-\d{2})/i.test(line)) details.passportExpiry = RegExp.$1.trim();
        if (/Nationality:\s*([A-Za-z]{2})/i.test(line)) details.nationality = RegExp.$1.trim().toUpperCase();
        if (/Email:\s*(.+@.+\..+)/i.test(line)) details.email = RegExp.$1.trim();
        if (/Phone:\s*(\d+)/i.test(line)) details.phone = RegExp.$1.trim();
    }

    return details;
}

function validatePassengerDetails(details, type) {
    const required = {
        firstName: 'First Name',
        lastName: 'Last Name',
        gender: 'Gender',
        dateOfBirth: 'Date of Birth',
        passportNumber: 'Passport Number',
        passportExpiry: 'Passport Expiry',
        nationality: 'Nationality',
        email: 'Email',
        phone: 'Phone'
    };

    const missing = Object.keys(required).filter(field => !details[field]);
    if (missing.length) {
        return {
            valid: false,
            message: `Missing required fields: ${missing.map(field => required[field]).join(', ')}`
        };
    }

    if (!validateDate(details.dateOfBirth)) {
        return {
            valid: false,
            message: 'Invalid Date of Birth format. Use YYYY-MM-DD'
        };
    }

    if (!validateDate(details.passportExpiry)) {
        return {
            valid: false,
            message: 'Invalid Passport Expiry format. Use YYYY-MM-DD'
        };
    }

    if (new Date(details.passportExpiry) < new Date()) {
        return {
            valid: false,
            message: 'Passport must be valid (expiry date in future)'
        };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email)) {
        return {
            valid: false,
            message: 'Invalid email format'
        };
    }

    if (details.phone.length < 8) {
        return {
            valid: false,
            message: 'Phone number too short'
        };
    }

    if (type === 'Child') {
        const dob = new Date(details.dateOfBirth);
        const age = (new Date().getFullYear() - dob.getFullYear());
        if (age >= 12) {
            return {
                valid: false,
                message: 'Child passenger must be under 12 years old'
            };
        }
    }

    return { valid: true, message: '' };
}

function validateDate(date, format = 'YYYY-MM-DD') {
    const d = new Date(date);
    return !isNaN(d.getTime()) && date.match(/^\d{4}-\d{2}-\d{2}$/);
}

async function getConversationState(phoneNumber) {
    const [rows] = await pool.execute(`SELECT * FROM ${dbPrefix}conversations WHERE phone_number = ?`, [phoneNumber]);
    if (!rows.length) {
        await pool.execute(`INSERT INTO ${dbPrefix}conversations (phone_number, step) VALUES (?, ?)`, [phoneNumber, 'new']);
        return { phone_number: phoneNumber, step: 'new' };
    }
    return rows[0];
}

async function updateConversationState(phoneNumber, data) {
    const fields = Object.keys(data);
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = [...Object.values(data), phoneNumber];
    await pool.execute(`UPDATE ${dbPrefix}conversations SET ${setClause} WHERE phone_number = ?`, values);
}

async function handleToLocation(phoneNumber, toLocation, fromCode, fromName, departureDate, returnDate) {
    let lastConversation = null;
    if (!toLocation) {
        const [rows] = await pool.execute(
            `SELECT * FROM ${dbPrefix}conversations WHERE phone_number = ? ORDER BY updated_at DESC LIMIT 1`,
            [phoneNumber]
        );
        lastConversation = rows[0];

        if (lastConversation.to_location_type === 'country') {
            toLocation = lastConversation.to_country;
        } else if (lastConversation.to_location_type === 'city') {
            toLocation = lastConversation.to_city;
        } else if (lastConversation.to_location_type === 'airport') {
            toLocation = lastConversation.to_city;
        }
    }

    const toAnalysis = await detectLocationType(toLocation);

    if (toAnalysis.type === 'country') {
        await updateConversationState(phoneNumber, {
            step: 'awaiting_to_city',
            to_location_type: 'country',
            to_country: toAnalysis.name,
            to_city: null,
            to_airport_options: null,
            from_code: fromCode,
            from_name: fromName,
            departure_date: departureDate,
            needs_return: returnDate ? 1 : 0,
            return_date: returnDate
        });
        await sendWhatsAppMessage(phoneNumber, `Please specify a city in ${toAnalysis.name} for arrival:`);
    } else if (toAnalysis.type === 'multi_city') {
        const [airports] = await pool.execute(`SELECT iata_code, name FROM ${dbPrefix}airports WHERE municipality = ?`, [toAnalysis.name]);
        const options = airports.map(airport => {
            const name = `${airport.name} (${airport.iata_code})`;
            return {
                id: `to_${airport.iata_code}`,
                title: name.length > 24 ? name.substring(0, 21) + '...' : name
            };
        });

        await updateConversationState(phoneNumber, {
            step: 'awaiting_to_airport',
            to_location_type: 'city',
            to_city: toAnalysis.name,
            to_airport_options: JSON.stringify(options),
            from_code: fromCode,
            from_name: fromName,
            departure_date: departureDate,
            needs_return: returnDate ? 1 : 0,
            return_date: returnDate
        });
        await sendInteractiveList(phoneNumber, `Select arrival airport in ${toAnalysis.name}:`, [{ title: 'Airports', rows: options }]);
    } else if (toAnalysis.type === 'city' || toAnalysis.type === 'airport') {
        const toCode = toAnalysis.code;
        const toName = toAnalysis.name;

        await updateConversationState(phoneNumber, {
            step: 'awaiting_passengers',
            to_code: toCode,
            to_name: toName,
            to_location_type: toAnalysis.type,
            to_city: toAnalysis.type === 'city' ? toName : toAnalysis.city,
            from_code: fromCode,
            from_name: fromName,
            departure_date: departureDate,
            needs_return: returnDate ? 1 : 0,
            return_date: returnDate
        });
        const message = `✈️ Flight from ${fromName} (${fromCode}) to ${toName} (${toCode}) on ${departureDate}\n` +
            (returnDate ? `Returning on ${returnDate}\n` : '') +
            `\nNow, how many passengers?\n` +
            `Format: Adults:X Children:Y\n` +
            `Example: Adults:2 Children:1`;
        await sendWhatsAppMessage(phoneNumber, message);
    } else {
        await sendWhatsAppMessage(phoneNumber, `⚠️ Couldn't identify arrival location. Please try again.`);
    }
}

// Webhook Function
async function wpWebhook(req, res) {

    // const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'your_verify_token'; // fallback for dev

    
    // if (req.method === 'GET') {
    //     const mode = req.query['hub.mode'];
    //     const token = req.query['hub.verify_token'];
    //     const challenge = req.query['hub.challenge'];

    //     if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    //         return res.status(200).send(challenge);
    //     } else {
    //         return res.sendStatus(403);
    //     }
    // }

    try {
        // Log input for debugging
        await fs.appendFile('debug_input.txt', JSON.stringify(req.body) + '\n');

        const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        if (!message) {
            return res.sendStatus(200);
        }

        const phoneNumber = message.from;
        let text, interactive;
        if (message.text) {
            text = message.text.body;
        } else if (message.interactive?.list_reply) {
            interactive = message.interactive.list_reply.id;
        } else {
            return res.sendStatus(200);
        }

        const state = await getConversationState(phoneNumber);

        // Conversation Flow
        if (text?.toLowerCase() === 'hi' || state.step === 'new') {
            await updateConversationState(phoneNumber, { step: 'awaiting_category' });
            await sendInteractiveList(phoneNumber, 'Please choose a category:', [{
                title: 'Categories',
                rows: [
                    { id: 'flights', title: 'Flights' },
                    { id: 'hotels', title: 'Hotels' }
                ]
            }]);
        } else if (state.step === 'awaiting_category' && interactive === 'flights') {
            await updateConversationState(phoneNumber, { step: 'awaiting_flight_details' });
            await sendWhatsAppMessage(phoneNumber,
                `🛫 Let's book your flight! Please provide:\n\n` +
                `1. Travel details:\n` +
                `Format: From [Location] To [Location] [DepartureDate]\n` +
                `Example: From Beirut To Dubai 2025-05-15\n\n` +
                `Need a return ticket? Include return date:\n` +
                `From [Location] To [Location] [DepartureDate] [ReturnDate]\n` +
                `Example: From Beirut To Dubai 2025-05-15 2025-05-20`
            );
        } else if (state.step === 'awaiting_flight_details' && text) {

            const match = text.match(/from (.+?) to (.+?) (\d{4}-\d{2}-\d{2})(?:\s+(\d{4}-\d{2}-\d{2}))?/i);
            if (match) {
                const [, fromLocation, toLocation, departureDate, returnDate] = match;

                const fromAnalysis = await detectLocationType(fromLocation);
                const toAnalysis = await detectLocationType(toLocation);

                const errorArray = [
                    { key: 'test', value: match },
                    { key: 'sdkjfskdjfh', value: text },

                ];
                await fs.appendFile(
                    'error_log.txt',
                    JSON.stringify(errorArray) + '\n'
                );

                
                await updateConversationState(phoneNumber, {
                    temp_departure_date: departureDate || null,
                    temp_return_date: returnDate || null
                });

                if (toAnalysis.type === 'country') {
                    await updateConversationState(phoneNumber, {
                        to_location_type: 'country',
                        to_country: toLocation || null
                    });
                } else if (toAnalysis.type === 'multi_city') {
                    await updateConversationState(phoneNumber, {
                        to_location_type: 'city',
                        to_city: toLocation || null
                    });
                } else if (toAnalysis.type === 'city') {
                    await updateConversationState(phoneNumber, {
                        to_location_type: 'city',
                        to_city: toLocation || null
                    });
                } else if (toAnalysis.type === 'airport') {
                    await updateConversationState(phoneNumber, {
                        to_location_type: 'airport',
                        to_city: toLocation || null
                    });
                }

                if (fromAnalysis.type === 'country') {
                    await updateConversationState(phoneNumber, {
                        step: 'awaiting_from_city',
                        from_location_type: 'country',
                        from_country: fromAnalysis.name || null,
                        from_city: null,
                        from_airport_options: null
                    });
                    await sendWhatsAppMessage(phoneNumber, `Please specify a city in ${fromAnalysis.name} for departure:`);
                } else if (fromAnalysis.type === 'multi_city') {
                    const [airports] = await pool.execute(`SELECT iata_code, name FROM ${dbPrefix}airports WHERE municipality = ?`, [fromAnalysis.name]);
                    const options = airports.map(airport => ({
                        id: `from_${airport.iata_code}`,
                        title: `${airport.name} (${airport.iata_code})`.substring(0, 24)
                    }));

                    await updateConversationState(phoneNumber, {
                        step: 'awaiting_from_airport',
                        from_location_type: 'city',
                        from_city: fromAnalysis.name || null,
                        from_airport_options: JSON.stringify(options)
                    });
                    await sendInteractiveList(phoneNumber, `Select departure airport in ${fromAnalysis.name}:`, [{ title: 'Airports', rows: options }]);
                } else if (fromAnalysis.type === 'city' || fromAnalysis.type === 'airport') {
                    const fromCode = fromAnalysis.code;
                    const fromName = fromAnalysis.name;

                    await updateConversationState(phoneNumber, {
                        from_code: fromCode || null,
                        from_name: fromName || null,
                        from_location_type: fromAnalysis.type || null,
                        from_city: fromAnalysis.type === 'city' ? fromName : fromAnalysis.city
                    });

                    await handleToLocation(phoneNumber, toLocation, fromCode, fromName, departureDate, returnDate);
                } else {
                    await sendWhatsAppMessage(phoneNumber, `⚠️ Couldn't identify departure location. Please try again.`);
                }
            } else {
                await sendWhatsAppMessage(phoneNumber,
                    `❌ Invalid format. Please use:\n` +
                    `From [Location] To [Location] [YYYY-MM-DD] for one-way\n` +
                    `or\n` +
                    `From [Location] To [Location] [YYYY-MM-DD] [YYYY-MM-DD] for round-trip`
                );
            }
        } else if (state.step === 'awaiting_from_city' && text) {
            const cityName = text;
            const [airports] = await pool.execute(
                `SELECT iata_code, name, municipality FROM ${dbPrefix}airports WHERE (municipality LIKE ? OR name LIKE ?) AND country_name = ?`,
                [`%${cityName}%`, `%${cityName}%`, state.from_country]
            );

            if (airports.length === 1) {
                const fromCode = airports[0].iata_code;
                const fromName = airports[0].municipality || airports[0].name;

                await updateConversationState(phoneNumber, {
                    step: 'awaiting_to_location',
                    from_code: fromCode,
                    from_name: fromName,
                    from_city: cityName
                });

                const match = (state.temp_message || '').match(/from (.+?) to (.+?) (\d{4}-\d{2}-\d{2})(?:\s+(\d{4}-\d{2}-\d{2}))?/i);
                const toLocation = match ? match[2] : '';

                await handleToLocation(phoneNumber, toLocation, fromCode, fromName, state.temp_departure_date, state.temp_return_date);
            } else if (airports.length > 1) {
                const options = airports.map(airport => {
                    const displayName = airport.municipality ? `${airport.municipality} (${airport.name})` : airport.name;
                    return {
                        id: `from_${airport.iata_code}`,
                        title: displayName.length > 24 ? displayName.substring(0, 21) + '...' : displayName
                    };
                });

                await updateConversationState(phoneNumber, {
                    step: 'awaiting_from_airport',
                    from_city: cityName,
                    from_airport_options: JSON.stringify(options)
                });

                await sendInteractiveList(phoneNumber, `Select departure airport in ${cityName}, ${state.from_country}:`, [{ title: 'Airports', rows: options }]);
            } else {
                await sendWhatsAppMessage(phoneNumber, `⚠️ No airports found in ${cityName}, ${state.from_country}\nPlease try another city or enter airport code directly`);
            }
        } else if (state.step === 'awaiting_from_airport' && interactive) {
            const iataCode = interactive.replace('from_', '');
            const [airports] = await pool.execute(`SELECT name, municipality FROM ${dbPrefix}airports WHERE iata_code = ?`, [iataCode]);

            if (airports.length) {
                const fromCode = iataCode;
                const fromName = airports[0].municipality || airports[0].name;

                await updateConversationState(phoneNumber, {
                    from_code: fromCode,
                    from_name: fromName
                });

                const match = (state.temp_message || '').match(/from (.+?) to (.+?) (\d{4}-\d{2}-\d{2})(?:\s+(\d{4}-\d{2}-\d{2}))?/i);
                const toLocation = match ? match[2] : '';

                await handleToLocation(phoneNumber, toLocation, fromCode, fromName, state.temp_departure_date, state.temp_return_date);
            } else {
                await sendWhatsAppMessage(phoneNumber, `⚠️ Airport not found. Please try again.`);
            }
        } else if (state.step === 'awaiting_to_airport' && interactive) {
            const iataCode = interactive.replace('to_', '');
            const [airports] = await pool.execute(`SELECT name, municipality FROM ${dbPrefix}airports WHERE iata_code = ?`, [iataCode]);

            if (airports.length) {
                const toCode = iataCode;
                const toName = airports[0].municipality || airports[0].name;

                await updateConversationState(phoneNumber, {
                    step: 'awaiting_passengers',
                    to_code: toCode,
                    to_name: toName
                });

                const [latestState] = await pool.execute(`SELECT * FROM ${dbPrefix}conversations WHERE phone_number = ?`, [phoneNumber]);
                const { from_name, from_code, to_name, to_code, departure_date, return_date } = latestState[0];

                await sendWhatsAppMessage(phoneNumber,
                    `✈️ Flight from ${from_name} (${from_code}) to ${to_name} (${to_code}) on ${departure_date}\n` +
                    (return_date ? `Returning on ${return_date}\n` : '') +
                    `\nNow, how many passengers?\n` +
                    `Format: Adults:X Children:Y\n` +
                    `Example: Adults:2 Children:1`
                );
            } else {
                await sendWhatsAppMessage(phoneNumber, `⚠️ Airport not found. Please try again.`);
            }
        } else if (state.step === 'awaiting_passengers' && text) {
            const match = text.match(/adults:\s*(\d+)\s*children:\s*(\d+)/i);
            if (match) {
                const adults = parseInt(match[1]);
                const children = parseInt(match[2]);

                if (adults < 1) {
                    await sendWhatsAppMessage(phoneNumber, `❌ At least 1 adult is required. Please specify again.`);
                    return;
                }

                if (adults + children > 9) {
                    await sendWhatsAppMessage(phoneNumber, `❌ Maximum 9 passengers allowed. Please specify again.`);
                    return;
                }

                const departureFlights = await getFlights(state.from_code, state.to_code, state.departure_date, adults);
                if (departureFlights.error || !departureFlights.length) {
                    await sendWhatsAppMessage(phoneNumber, `❌ No flights found for your criteria`);
                    return;
                }

                let returnFlights = [];
                if (state.needs_return) {
                    returnFlights = await getFlights(state.to_code, state.from_code, state.return_date, adults);
                }

                await updateConversationState(phoneNumber, {
                    step: 'awaiting_flight_selection',
                    adults,
                    children,
                    departure_flights: JSON.stringify(departureFlights),
                    return_flights: JSON.stringify(returnFlights)
                });

                let response = `✈️ Available departure flights for ${state.departure_date}:\n\n`;
                departureFlights.forEach((flight, i) => {
                    const seg = flight.itineraries[0].segments[0];
                    response += `${i + 1}. ${seg.carrierCode}${seg.flightNumber}\n` +
                        `   🛫 ${seg.departure.iataCode} ${new Date(seg.departure.at).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}\n` +
                        `   🛬 ${seg.arrival.iataCode} ${new Date(seg.arrival.at).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}\n` +
                        `   💰 ${flight.price.total} ${flight.price.currency}\n\n`;
                });

                if (state.needs_return) {
                    response += `\nReturn date: ${state.return_date} - We'll show return options after you select departure flight.`;
                }

                await sendWhatsAppMessage(phoneNumber, response + `Reply with the departure flight number (1, 2, or 3)`);
            } else {
                await sendWhatsAppMessage(phoneNumber,
                    `❌ Invalid format. Please use:\n` +
                    `Adults:X Children:Y\n` +
                    `Example: Adults:2 Children:1`
                );
            }
        } else if (state.step === 'awaiting_flight_selection' && text && /^[1-3]$/.test(text)) {
            const departureFlights = JSON.parse(state.departure_flights);
            const flightIndex = parseInt(text) - 1;

            if (!departureFlights[flightIndex]) {
                await sendWhatsAppMessage(phoneNumber, `❌ Invalid selection. Please try again.`);
                return;
            }

            const selectedDeparture = departureFlights[flightIndex];

            if (state.needs_return) {
                const returnFlights = JSON.parse(state.return_flights);
                if (!returnFlights.length) {
                    await sendWhatsAppMessage(phoneNumber, `❌ No return flights found for ${state.return_date}`);
                    return;
                }

                await updateConversationState(phoneNumber, {
                    step: 'awaiting_return_selection',
                    selected_departure: JSON.stringify(selectedDeparture)
                });

                let response = `✈️ Available return flights for ${state.return_date}:\n\n`;
                returnFlights.forEach((flight, i) => {
                    const seg = flight.itineraries[0].segments[0];
                    response += `${i + 1}. ${seg.carrierCode}${seg.flightNumber}\n` +
                        `   🛫 ${seg.departure.iataCode} ${new Date(seg.departure.at).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}\n` +
                        `   🛬 ${seg.arrival.iataCode} ${new Date(seg.arrival.at).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}\n` +
                        `   💰 ${flight.price.total} ${flight.price.currency}\n\n`;
                });

                await sendWhatsAppMessage(phoneNumber, response + `Reply with the return flight number (1, 2, or 3)`);
            } else {
                const totalPrice = selectedDeparture.price.total * (state.adults + state.children * 0.8);

                await updateConversationState(phoneNumber, {
                    step: 'awaiting_confirmation',
                    selected_departure: JSON.stringify(selectedDeparture),
                    selected_return: null
                });

                const confirmationMessage = `✅ Please confirm your one-way booking:\n\n` +
                    `✈️ Flight Details:\n` +
                    `Flight: ${selectedDeparture.itineraries[0].segments[0].carrierCode}${selectedDeparture.itineraries[0].segments[0].flightNumber}\n` +
                    `From: ${selectedDeparture.itineraries[0].segments[0].departure.iataCode}\n` +
                    `To: ${selectedDeparture.itineraries[0].segments[0].arrival.iataCode}\n` +
                    `Date: ${new Date(selectedDeparture.itineraries[0].segments[0].departure.at).toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}\n` +
                    `\n👥 Passengers:\n` +
                    `Adults: ${state.adults}, Children: ${state.children}\n` +
                    `\n💰 Total Price: ${totalPrice.toFixed(2)} ${selectedDeparture.price.currency}\n\n` +
                    `Type 'CONFIRM' to proceed with booking`;

                await sendWhatsAppMessage(phoneNumber, confirmationMessage);
            }
        } else if (state.step === 'awaiting_return_selection' && text && /^[1-3]$/.test(text)) {
            const returnFlights = JSON.parse(state.return_flights);
            const flightIndex = parseInt(text) - 1;

            if (!returnFlights[flightIndex]) {
                await sendWhatsAppMessage(phoneNumber, `❌ Invalid selection. Please try again.`);
                return;
            }

            const selectedReturn = returnFlights[flightIndex];
            const selectedDeparture = JSON.parse(state.selected_departure);
            const totalPrice = (selectedDeparture.price.total + selectedReturn.price.total) * (state.adults + state.children * 0.8);

            await updateConversationState(phoneNumber, {
                step: 'awaiting_confirmation',
                selected_return: JSON.stringify(selectedReturn)
            });

            const confirmationMessage = `✅ Please confirm your round-trip booking:\n\n` +
                `✈️ Departure Flight:\n` +
                `Flight: ${selectedDeparture.itineraries[0].segments[0].carrierCode}${selectedDeparture.itineraries[0].segments[0].flightNumber}\n` +
                `From: ${selectedDeparture.itineraries[0].segments[0].departure.iataCode}\n` +
                `To: ${selectedDeparture.itineraries[0].segments[0].arrival.iataCode}\n` +
                `Date: ${new Date(selectedDeparture.itineraries[0].segments[0].departure.at).toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}\n\n` +
                `✈️ Return Flight:\n` +
                `Flight: ${selectedReturn.itineraries[0].segments[0].carrierCode}${selectedReturn.itineraries[0].segments[0].flightNumber}\n` +
                `From: ${selectedReturn.itineraries[0].segments[0].departure.iataCode}\n` +
                `To: ${selectedReturn.itineraries[0].segments[0].arrival.iataCode}\n` +
                `Date: ${new Date(selectedReturn.itineraries[0].segments[0].departure.at).toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}\n` +
                `\n👥 Passengers:\n` +
                `Adults: ${state.adults}, Children: ${state.children}\n` +
                `\n💰 Total Price: ${totalPrice.toFixed(2)} ${selectedDeparture.price.currency}\n\n` +
                `Type 'CONFIRM' to proceed with booking`;

            await sendWhatsAppMessage(phoneNumber, confirmationMessage);
        } else if (state.step === 'awaiting_confirmation' && text && text.toUpperCase() === 'CONFIRM') {
            const bookingRef = `BOOK-${uuidv4().slice(0, 6).toUpperCase()}`;
            const selectedDeparture = JSON.parse(state.selected_departure);
            const selectedReturn = state.selected_return ? JSON.parse(state.selected_return) : null;

            let totalPrice = selectedDeparture.price.total * (state.adults + state.children * 0.8);
            if (selectedReturn) {
                totalPrice += selectedReturn.price.total * (state.adults + state.children * 0.8);
            }

            const flightDetails = {
                departure: selectedDeparture,
                return: selectedReturn
            };

            await pool.execute(
                `INSERT INTO ${dbPrefix}bookings (phone_number, booking_reference, flight_details, payment_status, amount, currency) VALUES (?, ?, ?, ?, ?, ?)`,
                [phoneNumber, bookingRef, JSON.stringify(flightDetails), 'pending', totalPrice, selectedDeparture.price.currency]
            );

            await sendWhatsAppMessage(phoneNumber,
                `🎉 Booking confirmed!\n` +
                `Booking Reference: ${bookingRef}\n` +
                `Total Amount: ${totalPrice.toFixed(2)} ${selectedDeparture.price.currency}\n\n` +
                `We'll now collect passenger details. Please wait for the next message...`
            );

            await updateConversationState(phoneNumber, {
                step: 'collecting_adult_1',
                passenger_details: JSON.stringify({
                    adults: state.adults,
                    children: state.children,
                    passengers: []
                })
            });

            await sendPassengerDetailsTemplate(phoneNumber, 1, 'Adult');
        } else if (state.step.startsWith('collecting_') && text) {
            const passengerType = state.step.includes('adult') ? 'Adult' : 'Child';
            const passengerNumber = parseInt(state.step.split('_').pop());
            const passengerDetails = JSON.parse(state.passenger_details);

            const details = parsePassengerDetails(text);
            const validation = validatePassengerDetails(details, passengerType);

            if (!validation.valid) {
                await sendWhatsAppMessage(phoneNumber, `❌ Invalid details:\n${validation.message}`);
                await sendPassengerDetailsTemplate(phoneNumber, passengerNumber, passengerType);
                return;
            }

            passengerDetails.passengers.push({
                type: passengerType,
                number: passengerNumber,
                firstName: details.firstName,
                lastName: details.lastName,
                gender: details.gender,
                dateOfBirth: details.dateOfBirth,
                passportNumber: details.passportNumber,
                passportExpiry: details.passportExpiry,
                nationality: details.nationality,
                email: details.email,
                phone: details.phone
            });

            const totalPassengers = passengerDetails.adults + passengerDetails.children;
            const collectedPassengers = passengerDetails.passengers.length;

            if (collectedPassengers < totalPassengers) {
                const nextPassengerNumber = collectedPassengers + 1;
                const nextPassengerType = collectedPassengers < passengerDetails.adults ? 'Adult' : 'Child';

                await updateConversationState(phoneNumber, {
                    step: `collecting_${nextPassengerType.toLowerCase()}_${nextPassengerNumber}`,
                    passenger_details: JSON.stringify(passengerDetails)
                });

                await sendPassengerDetailsTemplate(phoneNumber, nextPassengerNumber, nextPassengerType);
            } else {
                await pool.execute(
                    `UPDATE ${dbPrefix}bookings SET passenger_details = ? WHERE phone_number = ? ORDER BY created_at DESC LIMIT 1`,
                    [JSON.stringify(passengerDetails), phoneNumber]
                );

                const [booking] = await pool.execute(
                    `SELECT booking_reference FROM ${dbPrefix}bookings WHERE phone_number = ? ORDER BY created_at DESC LIMIT 1`,
                    [phoneNumber]
                );

                if (booking.length && booking[0].booking_reference) {
                    const bookingRef = booking[0].booking_reference;
                    const paymentLink = `${process.env.BOOKING_BASE_URL}?booking_ref=${bookingRef}`;

                    await sendWhatsAppMessage(phoneNumber,
                        `✅ All passenger details received!\n\n` +
                        `Please complete your payment here:\n` +
                        `${paymentLink}\n\n` +
                        `Once payment is confirmed, we'll issue your tickets.`
                    );
                } else {
                    await sendWhatsAppMessage(phoneNumber, `❌ Error: Could not generate payment link. Please contact support.`);
                }

                await pool.execute(`DELETE FROM ${dbPrefix}conversations WHERE phone_number = ?`, [phoneNumber]);
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook error:', error.message);
        res.sendStatus(500);
    }
}

// Initialize tables
createTables().catch(console.error);

module.exports = {
    wpWebhook
};