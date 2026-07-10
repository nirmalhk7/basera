import React from 'react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    { month: 'Jan', high: 31, low: 17, rainfallMm: 1 },
    { month: 'Feb', high: 31, low: 18, rainfallMm: 1 },
    { month: 'Mar', high: 33, low: 21, rainfallMm: 0 },
    { month: 'Apr', high: 33, low: 24, rainfallMm: 1 },
    { month: 'May', high: 34, low: 27, rainfallMm: 13 },
    { month: 'Jun', high: 32, low: 26, rainfallMm: 523 },
    { month: 'Jul', high: 30, low: 25, rainfallMm: 841 },
    { month: 'Aug', high: 30, low: 25, rainfallMm: 585 },
    { month: 'Sep', high: 31, low: 25, rainfallMm: 341 },
    { month: 'Oct', high: 33, low: 24, rainfallMm: 89 },
    { month: 'Nov', high: 34, low: 21, rainfallMm: 10 },
    { month: 'Dec', high: 32, low: 18, rainfallMm: 2 }
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

  it('should render city name, population, and 12-month climate grid when zoomed in', () => {
    render(
      <CityDetectedPanel
        detectedCity={sampleMumbai}
        isZoomedIn={true}
        zoomLevel={10}
      />
    );

    expect(screen.getByTestId('city-detected-panel')).toBeInTheDocument();
    expect(screen.getByTestId('detected-city-name')).toHaveTextContent('Mumbai');
    expect(screen.getByText('21.3 Million')).toBeInTheDocument();
    expect(screen.getByText(/Monthly Climate \(High \/ Low °C\)/i)).toBeInTheDocument();
    expect(screen.getByText('Jan')).toBeInTheDocument();
  });

  it('should render exact District reticle card without Center Target coordinates or Basera Target header', () => {
    render(
      <CityDetectedPanel
        detectedCity={null}
        activeDistrict={{
          districtName: 'Pune District',
          stateName: 'Maharashtra',
          locality: 'Shivajinagar',
          coordinates: [18.5204, 73.8567]
        }}
        isZoomedIn={true}
        zoomLevel={11}
      />
    );

    expect(screen.getByTestId('detected-city-name')).toHaveTextContent('Pune District');
    expect(screen.getByTestId('detected-city-state')).toHaveTextContent(/Maharashtra/i);
    expect(screen.queryByText(/Center \(\+\) Target/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/BASERA TARGET LAYER/i)).not.toBeInTheDocument();
  });
});
