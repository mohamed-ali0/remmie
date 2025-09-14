import React from 'react'
import { Container, Row,Col } from 'react-bootstrap'
import imgwatsapp from '/src/assets/images/tolk_watsapp.png';
import imgemail from '/src/assets/images/tolk_email.png';
import { Link } from 'react-router-dom';

export default function Tolkinstently() {
  return (
    <>
      <section className='space-py-100'>
        <Container>
            <Row className='gy-5 justify-content-center'>
                <Col xl={12}>
                    <h2 className='title text-center'>Talk to Remmie – Instantly on WhatsApp or Email!</h2>
                </Col>
                <Col md={6}>
                    <div className='tolkinstently_grid'>
                        <div className='img_wrap'>
                            <img src={imgwatsapp} alt="" className='img-fluid w-100'/>
                        </div>
                        <div className='tolkinstently_detail'>
                            <h4 className='text_success'>Talk to Remmie on WhatsApp!</h4>
                            <p>Send a message to [number], feel free to 
                            send a voice note too!</p>
                            <div className='button_group'>
                                 <a className='btn btn-success' href='https://wa.me/+15556432719' target='_blank' rel='noopener noreferrer'>
                                    Talk with Remmie on WhatsApp
                                  </a>
                                {/*<Link className='btn btn-success'>Talk with Remmie on WhatsApp</Link>*/}
                                {/*<Link className='btn btn-outline-success'>Learn More</Link>*/}
                            </div>
                        </div>
                    </div>
                </Col>
                {/*<Col md={6}>
                    <div className='tolkinstently_grid'>
                        <div className='img_wrap'>
                            <img src={imgemail} alt="" className='img-fluid w-100'/>
                        </div>
                        <div className='tolkinstently_detail'>
                            <h4 className='text_primary'>Reach Out to Remmie via Email!</h4>
                            <p>Drop a message at Remmie@email.com 
                            —Remmie will reply soon!</p>
                            <div className='button_group'>
                                <Link className='btn btn-primary'>Talk with Remmie on Email</Link>
                                <Link className='btn btn-outline-primary'>Learn More</Link>
                            </div>
                        </div>
                    </div>
                </Col>*/}
            </Row>
        </Container>
      </section>
    </>
  )
}
