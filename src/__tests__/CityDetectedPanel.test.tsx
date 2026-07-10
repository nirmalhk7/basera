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
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render city name, state, and elevation when detectedCity is provided and zoomed in', () => {
    render(
      <CityDetectedPanel
        detectedCity={sampleMumbai}
        isZoomedIn={true}
      />
    );

    expect(screen.getByTestId('city-detected-panel')).toBeInTheDocument();
    expect(screen.getByTestId('detected-city-name')).toHaveTextContent('Mumbai');
    expect(screen.getByTestId('detected-city-state')).toHaveTextContent('Maharashtra');
    expect(screen.getByText('14m ASL')).toBeInTheDocument();
    expect(screen.getByText('2.5 km away')).toBeInTheDocument();
  });

  it('should render dynamic town name when detectedCity is null but dynamicPlaceName is provided', () => {
    render(
      <CityDetectedPanel
        detectedCity={null}
        dynamicPlaceName="Manali"
        dynamicState="Himachal Pradesh"
        isZoomedIn={true}
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
        onCenterCity={onCenterCityMock}
      />
    );

    const focusButton = screen.getByText('Focus Mumbai');
    fireEvent.click(focusButton);
    expect(onCenterCityMock).toHaveBeenCalledWith(19.076, 72.8777);
  });
});
