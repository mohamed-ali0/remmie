import React, { useState, useEffect } from 'react';
import { Col, Form, FormLabel } from 'react-bootstrap';
import Slider from 'rc-slider';

export default function Filterbar({ filters, applyFilters }) {
    // Ensure that filters are always defined and have a valid structure
    const safeFilters = filters || {
        priceRange: [0, 100],
        search: '',
        stops: [],
        airlines: [],
        baggage: [],
        departureTime: [],
        arrivalTime: [],
        travelTimeRange: [0, 100],
    };

    // Initialize the component's internal state with safeFilters
    const [filterState, setFilterState] = useState(safeFilters);
    const [priceRange, setPriceRange] = useState(safeFilters.priceRange);
    const [travelTimeRange, setTravelTimeRange] = useState(safeFilters.travelTimeRange);

    // Sync filterState with parent filters whenever filters prop changes
    useEffect(() => {
        setFilterState(filters || safeFilters); // Use filters or fallback to safeFilters
    }, [filters]);

    // Handle slider changes (for price and travel time)
    const handleSliderChange = (type, newRange) => {
        if (type === 'price') {
            setPriceRange(newRange);
            applyFilters({ priceRange: newRange });
        } else if (type === 'travelTime') {
            setTravelTimeRange(newRange);
            applyFilters({ travelTimeRange: newRange });
        }
    };

    // Handle checkbox state change (for stops, airlines, baggage, etc.)
    const handleCheckboxChange = (key, value) => {
        const currentValues = filterState[key] || [];
        const newArray = currentValues.includes(value)
            ? currentValues.filter((item) => item !== value)
            : [...currentValues, value];
        const updatedFilters = { ...filterState, [key]: newArray };
        setFilterState(updatedFilters); // Update internal state
        applyFilters(updatedFilters); // Apply changes to parent state
    };

    return (
        <>
            <Col xl={12}>
                <div className='filter_grid'>
                    <div className='filter_header'>
                        <h4>Filter by</h4>
                    </div>
                    <div className='filter_body'>
                        <div className='form_group'>
                            <FormLabel>Stops</FormLabel>
                            <Form.Check
                                type="checkbox"
                                label="1 Stop"
                                onChange={() => handleCheckboxChange('stops', '1 Stop')}
                                checked={filterState.stops.includes('1 Stop')}
                            />
                        </div>
                        <div className='form_group'>
                            <FormLabel>Airlines</FormLabel>
                            <Form.Check
                                type="checkbox"
                                label="Scott"
                                onChange={() => handleCheckboxChange('airlines', 'Scott')}
                                checked={filterState.airlines.includes('Scott')}
                            />
                        </div>
                        <div className='form_group mb-0'>
                            <FormLabel>Travel and baggage</FormLabel>
                            <Form.Check
                                type="checkbox"
                                label="Carry-on bag included"
                                onChange={() => handleCheckboxChange('baggage', 'Carry-on bag included')}
                                checked={filterState.baggage.includes('Carry-on bag included')}
                            />
                        </div>
                    </div>
                </div>
            </Col>

            <Col xl={12}>
                <div className='filter_grid'>
                    <div className='filter_header d-flex align-items-center justify-content-between'>
                        <h4>Price</h4>
                        <span>Up to AED 25000</span>
                    </div>
                    <div className='filter_body'>
                        <Slider
                            range
                            min={0}
                            max={25000}  // Fixed price range max value
                            value={priceRange}
                            onChange={(newRange) => handleSliderChange('price', newRange)}
                        />
                    </div>
                </div>
            </Col>

            <Col xl={12}>
                <div className='filter_grid'>
                    <div className='filter_header d-flex align-items-center justify-content-between'>
                        <h4>Total Travel Time</h4>
                        <span>Under 15hr</span>
                    </div>
                    <div className='filter_body'>
                        <Slider
                            range
                            min={0}
                            max={900}  // Fixed max to represent 15 hours (900 minutes)
                            value={travelTimeRange}
                            onChange={(newRange) => handleSliderChange('travelTime', newRange)}
                        />
                    </div>
                </div>
            </Col>

            <Col xl={12}>
                <div className='filter_grid'>
                    <div className='filter_header'>
                        <h4>Departure Time</h4>
                    </div>
                    <div className='filter_body'>
                        <div className='form_group'>
                            <Form.Check
                                type="checkbox"
                                label="Morning (5:00am to 11:59am)"
                                onChange={() => handleCheckboxChange('departureTime', 'morning')}
                                checked={filterState.departureTime.includes('morning')}
                            />
                        </div>
                        <div className='form_group mb-0'>
                            <Form.Check
                                type="checkbox"
                                label="Evening (6:00pm to 11:59pm)"
                                onChange={() => handleCheckboxChange('departureTime', 'evening')}
                                checked={filterState.departureTime.includes('evening')}
                            />
                        </div>
                    </div>
                </div>
            </Col>

            <Col xl={12}>
                <div className='filter_grid'>
                    <div className='filter_header'>
                        <h4>Arrival Time</h4>
                    </div>
                    <div className='filter_body'>
                        <div className='form_group'>
                            <Form.Check
                                type="checkbox"
                                label="Morning (5:00am to 11:59am)"
                                onChange={() => handleCheckboxChange('arrivalTime', 'morning')}
                                checked={filterState.arrivalTime.includes('morning')}
                            />
                        </div>
                        <div className='form_group mb-0'>
                            <Form.Check
                                type="checkbox"
                                label="Evening (6:00pm to 11:59pm)"
                                onChange={() => handleCheckboxChange('arrivalTime', 'evening')}
                                checked={filterState.arrivalTime.includes('evening')}
                            />
                        </div>
                    </div>
                </div>
            </Col>
        </>
    );
}
