import React from 'react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CityDetectedPanel } from '../components/CityDetectedPanel';
import { DetectedPlace } from '../utils/geospatialDetector';

const sampleMumbai: DetectedPlace = {
  id: 'mumbai',
  name: 'Mumbai',
  state: 'Maharashtra',
  district: 'Mumbai City',
  placeType: 'Metro Area',
  elevationMeters: 14,
  populationEstimate: '21.3 Million',
  monthlyClimate: [
    { month: 'Jan', high: 31, low: 18 },
    { month: 'Feb', high: 31, low: 19 },
    { month: 'Mar', high: 33, low: 22 },
    { month: 'Apr', high: 33, low: 25 },
    { month: 'May', high: 34, low: 27 },
    { month: 'Jun', high: 32, low: 27 },
    { month: 'Jul', high: 30, low: 26 },
    { month: 'Aug', high: 30, low: 25 },
    { month: 'Sep', high: 31, low: 25 },
    { month: 'Oct', high: 33, low: 24 },
    { month: 'Nov', high: 34, low: 22 },
    { month: 'Dec', high: 32, low: 19 }
  ],
  coordinates: [19.076, 72.8777],
  detectionRadiusKm: 35,
  distanceKm: 2.5
};

describe('CityDetectedPanel Component', () => {
  it('should not render anything when isZoomedIn is false', () => {
    const { container } = render(
      <CityDetectedPanel
        detectedCity={sampleMumbai}
        isZoomedIn={false}
        zoomLevel={9}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render city name, state, population, and climate grid when detectedCity is provided and zoomed in', () => {
    render(
      <CityDetectedPanel
        detectedCity={sampleMumbai}
        isZoomedIn={true}
        zoomLevel={10}
      />
    );

    expect(screen.getByTestId('city-detected-panel')).toBeInTheDocument();
    expect(screen.getByTestId('detected-city-name')).toHaveTextContent('Mumbai');
    expect(screen.getByTestId('detected-city-state')).toHaveTextContent('Maharashtra');
    expect(screen.getByText('21.3 Million')).toBeInTheDocument();
    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.getByText('Dec')).toBeInTheDocument();
  });

  it('should render administrative detection level based on zoom magnification', () => {
    render(
      <CityDetectedPanel
        detectedCity={sampleMumbai}
        isZoomedIn={true}
        zoomLevel={13}
      />
    );

    expect(screen.getByText(/Taluka \/ Ward Level/i)).toBeInTheDocument();
  });

  it('should render dynamic town name when detectedCity is null but dynamicPlaceName is provided', () => {
    render(
      <CityDetectedPanel
        detectedCity={null}
        dynamicPlaceName="Manali"
        dynamicState="Himachal Pradesh"
        isZoomedIn={true}
        zoomLevel={11}
      />
    );

    expect(screen.getByTestId('detected-city-name')).toHaveTextContent('Manali');
    expect(screen.getByTestId('detected-city-state')).toHaveTextContent('Himachal Pradesh');
  });

  it('should trigger onCenterCity when focus button is clicked', () => {
    const onCenterCityMock = vi.fn();
    render(
      <CityDetectedPanel
        detectedCity={sampleMumbai}
        isZoomedIn={true}
        zoomLevel={10}
        onCenterCity={onCenterCityMock}
      />
    );

    const focusButton = screen.getByText('Focus Mumbai');
    fireEvent.click(focusButton);
    expect(onCenterCityMock).toHaveBeenCalledWith(19.076, 72.8777);
  });
});
