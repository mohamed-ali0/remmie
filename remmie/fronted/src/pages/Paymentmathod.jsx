import React, { useEffect, useState } from "react";
import Userprofilesidebar from '../components/Userprofilesidebar';
import {
  Card,
  Row,
  Col,
  Button,
  Spinner,
  Modal,
  Form,
} from "react-bootstrap";
import { IconTrash } from "@tabler/icons-react";
import axios from "axios";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

export default function PaymentMethods() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const stripe = useStripe();
  const elements = useElements();

  const token = localStorage.getItem("token");

  const fetchCards = async () => {
    try {
      setLoading(true);
      const res = await axios.post(
        "https://remmie.co:5000/api/stripe/user-payment-methods-list",
        { booking_ref: "BOOK-7FFB82", session_id: "cs_test_xxx" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) setCards(res.data.cards || []);
      else setCards([]);
    } catch (err) {
      console.error("Error fetching cards:", err);
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, [token]);

  // Delete Card
  const deleteCard = async (id) => {
    if (!window.confirm("Delete this card?")) return;
    try {
      await axios.post(
        "https://remmie.co:5000/api/stripe/user-payment-methods-delete",
        { card_id: id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchCards();
    } catch (err) {
      console.error("Error deleting card:", err);
    }
  };

  // Set Default Card
  const setDefaultCard = async (id) => {
    try {
      await axios.post(
        "https://remmie.co:5000/api/stripe/user-payment-methods-setdefault",
        { card_id: id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchCards();
    } catch (err) {
      console.error("Error updating card:", err);
    }
  };

  // ✅ Add New Card
  const addNewCard = () => {
    setShowModal(true);
  };

  const handleSaveCard = async () => {
    if (!stripe || !elements) return;

    setSaving(true);

    try {
      // 1. Create PaymentMethod
      const cardElement = elements.getElement(CardElement);
      const { paymentMethod, error } = await stripe.createPaymentMethod({
        type: "card",
        card: cardElement,
      });

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }

      // 2. Send to backend
      await axios.post(
        "https://remmie.co:5000/api/stripe/user-payment-methods-add",
        { payment_method_id: paymentMethod.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowModal(false);
      fetchCards();
    } catch (err) {
      console.error("Error adding card:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container space-py-100">
      <Row className="justify-content-center">
        <Col md="6">
          <Card>
            <Card.Body>
              <h4 className="mb-4">Payment methods</h4>

              {loading ? (
                <div className="text-center">
                  <Spinner animation="border" />
                </div>
              ) : cards.length === 0 ? (
                <p>No saved payment methods.</p>
              ) : (
                cards.map((card) => (
                  <Card key={card.id} className="mb-3 shadow-sm">
                    <Card.Body>
                      <Row className="align-items-center">
                        <Col>
                          <h6 className="mb-0">
                            {card.brand.toUpperCase()} •••• {card.last4}
                          </h6>
                          <small className="text-muted">
                            Expires {card.exp_month}/{card.exp_year}
                          </small>
                          {card.is_default && (
                            <span className="badge bg-success ms-2">
                              Default
                            </span>
                          )}
                        </Col>
                        <Col xs="auto">
                          {!card.is_default && (
                            <Button
                              variant="outline-success"
                              size="sm"
                              onClick={() => setDefaultCard(card.id)}
                            >
                              Make Default
                            </Button>
                          )}
                          <Button
                            variant="light"
                            size="sm"
                            onClick={() => deleteCard(card.id)}
                          >
                            <IconTrash size={18} />
                          </Button>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                ))
              )}

              {/* Add New Button */}
              <Button variant="primary" onClick={addNewCard}>
                Add New Card
              </Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
            <Userprofilesidebar/>
          </Col>
      </Row>

      {/* Modal for Add Card */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add New Card</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>Card Details</Form.Label>
              <div className="border p-2 rounded">
                <CardElement />
              </div>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveCard} disabled={saving}>
            {saving ? "Saving..." : "Save Card"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
