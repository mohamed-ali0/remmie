import React from 'react'
import { Row, Col } from 'react-bootstrap';
import {Link } from 'react-router-dom'

import travelassistance from '/src/assets/images/travel_assistence.png';
export default function Travelplansassistance() {
  return (
    <>
        <div className='tranveplan_assistance'>            
            <Row className='align-items-center'>               
                <Col xl={7}>
                    <h2 className='text-white mb-3'>Need assistance in your travel plans?</h2>
                    <p className='text-white mb-4'>Let Remmie AI find you cheap flights and great hotels fast. Start planning now—your adventure awaits!</p>
                    <Link to="" className='btn btn-white px-5'>Learn More</Link>
                </Col>
                <Col xl={5}>
                    <img src={travelassistance} alt="" className='img-fluid w-100'/>
                </Col>
            </Row>
        </div>
    </>
  )
}
