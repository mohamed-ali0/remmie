import React from "react";
import 'animate.css';
import { Routes, Route, BrowserRouter, useLocation,Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Faqpage from "./pages/Faqpage";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Flight from "./pages/Flight";
import Chatbox from './components/Chatbox';
import Providers from './context/Providers';
import Signin from './components/Signin';
import Signup from './components/Signup';
import Bookingcart from './pages/Bookingcart';
import Bookingsuccess from './pages/Bookingsuccess';
import Userprofile from './pages/Userprofile';
import Flightorderhistory from './pages/Flightorderhistory';
import Staysorderhistory from './pages/Staysorderhistory';
import Staysbookingdetails from './pages/Staysbookingdetails';
import Staycart from './pages/Staycart';
import PrivateRoute from './components/PrivateRoute';
import Bookingdetails from './pages/Bookingdetails';
import Staybookingsuccess from './pages/Staybookingsuccess';
import Changepassword from './pages/Changepassword';
import Paymentmathod from './pages/Paymentmathod';
import { getToken, isTokenExpired } from './utils/auth';
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const routesWithoutExtras = [
    "/verify-email",
    "/verify-pin",
    "/landing",
    "/error-page",
    "/sign-in",
    "/sign-up"
];
function AppContent() {


    const location = useLocation();
    const isSpecialRoute = routesWithoutExtras.includes(location.pathname);

    const headerEnabled = true;
    const footerEnabled = true;

    // Auth check
    const token = getToken();
    const isLoggedIn = token && !isTokenExpired(token);

    return (
        <>
            
            {/* Start Header */}
            {!isSpecialRoute && location.pathname !== "/error-page" && headerEnabled && <Header />}
            {/* End Header */}

            <Routes>
                <Route exact path="/" element={<Index />} />
                <Route exact path="/flight" element={<Flight/>} />
                <Route exact path="/faq" element={<Faqpage/>} />
                <Route exact path="/about" element={<About/>} />
                <Route exact path="/contact" element={<Contact/>} />
                <Route exact path="/sign-in" element={<Signin/>}/>
                <Route exact path="/sign-up" element={<Signup/>}/>
                <Route exact path="/userprofile" element={<Userprofile/>}/>
                <Route exact path="/flightorderhistory" element={<Flightorderhistory/>}/>
                <Route exact path="/booking-details" element={<Bookingdetails/>} />
                <Route exact path="/staysorderhistory" element={<Staysorderhistory/>} />
                <Route exact path="/staysbookingdetails" element={<Staysbookingdetails/>} />
                {/*<Route exact path="/Staycart" element={<Staycart/>}/>*/}
                {/* Protected route for booking */}

                {/*<Route exact path="/bookingcart" element={<Bookingcart/>}/>*/}
                <Route exact path="/booking-success" element={<Bookingsuccess/>} />

                <Route exact path="/stay-booking-success" element={<Staybookingsuccess/>} />
                <Route exact path="/change-password" element={<Changepassword/>} />
                {/*<Route exact path="/payment-mathod" element={<Paymentmathod/>} />*/}
                
                
                {/* PaymentMethod page Stripe Elements */}
                <Route
                  path="/payment-mathod"
                  element={
                    <Elements stripe={stripePromise}>
                      <Paymentmathod />
                    </Elements>
                  }
                />
                {/* Protected route for booking */}
                <Route
                    exact
                    path="/bookingcart"
                    element={
                        <PrivateRoute>
                            <Bookingcart />
                        </PrivateRoute>
                    }
                />
                <Route
                    exact
                    path="/Staycart"
                    element={
                        <PrivateRoute>
                            <Staycart />
                        </PrivateRoute>
                    }
                />
            </Routes>

            {/* Start Footer */}
            {!isSpecialRoute && location.pathname !== "/error-page" && headerEnabled && <Footer />}
            {/* End Footer */}

            {/* Chat Box */}
            {/* Chatbox only for logged-in users */}
            {/* {isLoggedIn && !isSpecialRoute && location.pathname !== "/error-page" && <Chatbox />} */}
            {isLoggedIn && !isSpecialRoute && location.pathname !== "/error-page" && headerEnabled && <Chatbox/>}
            {/* Chat Box */}
        </>
    );
}

export default function App() {
    return (
        <>
            <BrowserRouter basename='/' >
                <Providers>
                    <AppContent />
                </Providers>
            </BrowserRouter>
        </>
    );
}
