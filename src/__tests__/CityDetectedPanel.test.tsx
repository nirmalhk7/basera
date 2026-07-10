import React from 'react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CityDetectedPanel } from '../components/CityDetectedPanel';
import { DetectedPlace } from '../utils/geospatialDetector';
import * as weatherService from '../services/weatherService';

const sampleMumbai: DetectedPlace = {
  id: 'mumbai',
  name: 'Mumbai',
  state: 'Maharashtra',
  district: 'Mumbai City',
  placeType: 'Metro Area',
  elevationMeters: 14,
  populationEstimate: '21.3 Million',
  monthlyClimate: [],
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

  it('should render city name, population, and on-demand weather button when zoomed in', () => {
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
    expect(screen.getByTestId('fetch-weather-btn')).toBeInTheDocument();
  });

  it('should render exact District reticle card when activeDistrict is provided', () => {
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
    expect(screen.getByText(/Center \(\+\) Target:/i)).toBeInTheDocument();
  });

  it('should fetch live weather only when the user clicks Fetch Live Weather button', async () => {
    const fetchSpy = vi.spyOn(weatherService, 'fetchLiveWeather').mockResolvedValue({
      currentTemp: 31,
      feelsLike: 35,
      humidity: 78,
      windSpeedKmH: 14,
      conditionText: 'Partly Cloudy',
      dailyForecast: [
        { day: 'Mon', maxTemp: 33, minTemp: 26 },
        { day: 'Tue', maxTemp: 32, minTemp: 25 }
      ],
      fetchedAt: '02:30 PM'
    });

    render(
      <CityDetectedPanel
        detectedCity={sampleMumbai}
        isZoomedIn={true}
        zoomLevel={10}
      />
    );

    const btn = screen.getByTestId('fetch-weather-btn');
    fireEvent.click(btn);

    expect(fetchSpy).toHaveBeenCalledWith(19.076, 72.8777);

    await waitFor(() => {
      expect(screen.getByTestId('live-weather-card')).toBeInTheDocument();
      expect(screen.getByText('31°C')).toBeInTheDocument();
      expect(screen.getByText('Partly Cloudy')).toBeInTheDocument();
      expect(screen.getByText('Mon')).toBeInTheDocument();
    });

    fetchSpy.mockRestore();
  });
});
