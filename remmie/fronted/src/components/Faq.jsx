import { IconChevronUp } from '@tabler/icons-react'
import React, { useState } from 'react'
import { Container, Row, Col, Accordion } from 'react-bootstrap'

export default function Faq() {   
    const [activeKey, setActiveKey] = useState(null);
    const handleToggle = (key) => {
        setActiveKey(prevKey => (prevKey === key ? null : key));
    };
  return (
    <>
      
        <Accordion activeKey={activeKey} onSelect={handleToggle}>
            <Accordion.Item eventKey="0" className={activeKey === "0" ? 'accordion-item active' : 'accordion-item'}>
                <Accordion.Header>
                How does Remmie.ai work?
                <span className="icon_wrap"><IconChevronUp /></span>
                </Accordion.Header>
                <Accordion.Body>
                Just start chatting with Remmie! Tell us where you’re going, when, and what you need (flights, hotels, etc.), and we’ll search for the best options in real-time. Pick what you like, and we’ll handle the rest.
                </Accordion.Body>
            </Accordion.Item>

            <Accordion.Item eventKey="2" className={activeKey === "2" ? 'accordion-item active' : 'accordion-item'}>
                <Accordion.Header>
                Can Remmie.ai find the cheapest flights?
                <span className="icon_wrap"><IconChevronUp /></span>
                </Accordion.Header>
                <Accordion.Body>
                Just start chatting with Remmie! Tell us where you’re going, when, and what you need (flights, hotels, etc.), and we’ll search for the best options in real-time. Pick what you like, and we’ll handle the rest.
                </Accordion.Body>
            </Accordion.Item>

            <Accordion.Item eventKey="3" className={activeKey === "3" ? 'accordion-item active' : 'accordion-item'}>
                <Accordion.Header>
                Does Remmie.ai book hotels too?
                <span className="icon_wrap"><IconChevronUp /></span>
                </Accordion.Header>
                <Accordion.Body>
                Just start chatting with Remmie! Tell us where you’re going, when, and what you need (flights, hotels, etc.), and we’ll search for the best options in real-time. Pick what you like, and we’ll handle the rest.
                </Accordion.Body>
            </Accordion.Item>

            <Accordion.Item eventKey="4" className={activeKey === "4" ? 'accordion-item active' : 'accordion-item'}>
                <Accordion.Header>
                Can I plan an entire trip with Remmie.ai?
                <span className="icon_wrap"><IconChevronUp /></span>
                </Accordion.Header>
                <Accordion.Body>
                Just start chatting with Remmie! Tell us where you’re going, when, and what you need (flights, hotels, etc.), and we’ll search for the best options in real-time. Pick what you like, and we’ll handle the rest.
                </Accordion.Body>
            </Accordion.Item>
        </Accordion>
                    
    </>
  )
}
