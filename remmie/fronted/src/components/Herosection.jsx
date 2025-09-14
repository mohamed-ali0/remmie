import React from 'react'
import { Container, Row, Col } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import heroimg from '/src/assets/images/hero_img.png';
import { useChat } from '../context/ChatContext';


export default function Herosection() {
    const { toggleChat } = useChat();
    return (
        <>  
            <div className='bg_light p-md-4'>
                <div className='hero_section'>
                    <Container>
                        <Row className='align-items-center gy-4'>
                            <Col md={6}>
                                <div className='pe-3'>
                                    <h2 className='fw-bold text-white mb-3'>Smart Travel Starts with Remmie</h2>
                                    <p className='text-white mb-4'>Let Remmie AI help you build your perfect trip—effortlessly, discovering the best option is simple and stress-free.</p>
                                    <Link className='btn btn-white' onClick={toggleChat}>Talk to Remmie</Link>
                                </div>
                            </Col>
                            <Col md={6} className='text-lg-end'>
                                <div className='img_wrap'>
                                    <img src={heroimg} alt="" className='w-100 img-fluid'/>
                                </div>
                            </Col>
                        </Row>
                    </Container>
                </div>
            </div>
        </>
    )
}
