// frontend/src/pages/HomePage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../api/api.js';
import { MagnifyingGlassIcon, HomeModernIcon, KeyIcon, ChatBubbleLeftRightIcon, BuildingStorefrontIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
const SERVER_URL = process.env.REACT_APP_SERVER_BASE_URL || 'http://localhost:5000';
// Helper to construct image URLs, similar to other pages
const getListingImageUrl = (photoFilename) => {
    if (photoFilename) {
        // Assuming photoFilename is just the name like "image.jpg"
        return `${SERVER_URL}/uploads/${photoFilename}`;
    }
    // Fallback if no photo or filename is undefined
    return 'https://via.placeholder.com/1920x1080.png?text=Rental+Space'; // Generic fallback
};


function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  // State for hero background
  const [heroListings, setHeroListings] = useState([]);
  const [currentHeroImageIndex, setCurrentHeroImageIndex] = useState(0);
  const [loadingHeroImages, setLoadingHeroImages] = useState(true);

  // Fetch active listings for hero background
  useEffect(() => {
    const fetchHeroListings = async () => {
      setLoadingHeroImages(true);
      try {
        // Fetch a few recent, active listings with photos
        const response = await api.get('/listings?status=active&limit=5&sortBy=created_at&sortOrder=DESC');
        const listingsWithPhotos = response.data.listings.filter(l => l.photos && l.photos.length > 0);
        setHeroListings(listingsWithPhotos.length > 0 ? listingsWithPhotos : []);
      } catch (error) {
        console.error("Error fetching hero listings:", error);
        setHeroListings([]); // Fallback to empty if error
      } finally {
        setLoadingHeroImages(false);
      }
    };
    fetchHeroListings();
  }, []);

  // Effect to cycle through hero background images
  useEffect(() => {
    if (heroListings.length > 1) {
      const timer = setInterval(() => {
        setCurrentHeroImageIndex(prevIndex => (prevIndex + 1) % heroListings.length);
      }, 7000); // Change image every 7 seconds

      return () => clearInterval(timer); // Cleanup interval on unmount
    }
  }, [heroListings]);


  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/listings?location=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/listings');
    }
  };

  const featureCards = [
    {
      icon: <MagnifyingGlassIcon className="w-10 h-10 text-blue-600 mb-3" />,
      title: "Знайдіть своє ідеальне житло",
      description: "Легко шукайте та фільтруйте серед великої різноманітності добової та місячної оренди. Ваш наступний дім або відпочинок знаходяться лише за кілька кліків.",
      link: "/listings",
      linkText: "Переглянути оренду"
    },
    {
      icon: <HomeModernIcon className="w-10 h-10 text-blue-600 mb-3" />,
      title: "Розмістіть свою нерухомість",
      description: "Охопіть тисячі потенційних орендарів, розмістивши свою нерухомість. Наша платформа спрощує керування вашими орендами та бронюваннями.",
      link: isAuthenticated && user?.role === 'owner' ? "/create-listing" : "/register?role=owner",
      linkText: "Стати власником"
    },
    {
      icon: <ChatBubbleLeftRightIcon className="w-10 h-10 text-blue-600 mb-3" />,
      title: "Спілкуйтеся безпосередньо",
      description: "Легко спілкуйтеся з власниками нерухомості або орендарями через нашу інтегровану систему чату для запитів та домовленостей.",
      link: isAuthenticated ? "/my-chats" : "/login",
      linkText: "Переглянути чати"
    },
    {
        icon: <MapPinIcon className="w-10 h-10 text-blue-600 mb-3" />,
        title: "Досліджуйте на карті",
        description: "Візуалізуйте оголошення на інтерактивній карті, щоб легко знайти нерухомість у бажаному місці.",
        link: "/map-listings",
        linkText: "Переглянути карту"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
      {/* Hero Section */}
      <section className="relative text-white py-20 md:py-32 overflow-hidden">
        {/* Dynamic Background Images */}
        <div className="absolute inset-0 z-0">
          {(loadingHeroImages || heroListings.length === 0) ? (
            // Fallback static gradient if no images or still loading
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-700"></div>
          ) : (
            heroListings.map((listing, index) => (
              <div
                key={listing.id || index}
                className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out animate-kenburns-bg
                            ${index === currentHeroImageIndex ? 'opacity-100' : 'opacity-0'}`}
                style={{ backgroundImage: `url(${getListingImageUrl(listing.photos[0])})` }}
              />
            ))
          )}
        </div>

        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-60 z-10"></div>

        {/* Content */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-20">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6">
            Відкрийте свій наступний простір
          </h1>
          <p className="text-lg sm:text-xl text-slate-200 mb-10 max-w-2xl mx-auto">
            Знайдіть унікальні місця для короткострокового відпочинку або довгострокового проживання. Здавайте свою нерухомість з упевненістю та легкістю.
          </p>
          <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Введіть місто, район або адресу..."
              className="form-input flex-grow w-full sm:w-auto rounded-lg border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 text-slate-900 placeholder-slate-400 py-3 px-4 text-base"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg text-base transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75"
            >
              <MagnifyingGlassIcon className="w-5 h-5 inline-block mr-2 -mt-1" /> Пошук
            </button>
          </form>
           <Link
            to="/listings"
            className="mt-8 inline-block text-blue-300 hover:text-blue-200 hover:underline transition-colors text-sm"
          >
            Або переглянути всі оголошення »
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">
              Платформа, створена для вас
            </h2>
            <p className="text-slate-600 max-w-xl mx-auto text-lg">
              Незалежно від того, шукаєте ви місце чи пропонуєте його, ми надаємо вам необхідні інструменти.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {featureCards.map((feature, index) => (
              <div key={index} className="bg-slate-50 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col items-center text-center">
                {feature.icon}
                <h3 className="text-xl font-semibold text-slate-800 mb-2">{feature.title}</h3>
                <p className="text-slate-600 text-sm mb-4 flex-grow">{feature.description}</p>
                <Link
                  to={feature.link}
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
                >
                  {feature.linkText} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-16 md:py-24 bg-slate-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="bg-white p-8 rounded-lg shadow-xl text-center md:text-left">
              <BuildingStorefrontIcon className="w-12 h-12 text-blue-600 mb-4 mx-auto md:mx-0"/>
              <h3 className="text-2xl font-bold text-slate-800 mb-3">Готові знайти своє наступне житло?</h3>
              <p className="text-slate-600 mb-6">
                Досліджуйте тисячі перевірених оголошень. Фільтруйте за місцезнаходженням, ціною, зручностями та іншим.
              </p>
              <Link
                to="/listings"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg text-base transition-colors shadow-md"
              >
                Переглянути об'єкти
              </Link>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-xl text-center md:text-left">
              <KeyIcon className="w-12 h-12 text-green-600 mb-4 mx-auto md:mx-0"/>
              <h3 className="text-2xl font-bold text-slate-800 mb-3">Маєте нерухомість для здачі?</h3>
              <p className="text-slate-600 mb-6">
                Приєднуйтесь до нашої спільноти власників нерухомості. Розміщення безкоштовне, а керування просте.
              </p>
              <Link
                to={isAuthenticated && user?.role === 'owner' ? "/create-listing" : "/register?role=owner"}
                className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg text-base transition-colors shadow-md"
              >
                {isAuthenticated && user?.role === 'owner' ? "Створити оголошення" : "Розмістити свою нерухомість"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <style jsx global>{`
        .form-input { @apply shadow-sm; }

        @keyframes kenburns-variant {
          0% {
            transform: scale(1.1) translate(-2%, -2%);
          }
          100% {
            transform: scale(1.25) translate(2%, 2%);
          }
        }
        .animate-kenburns-bg {
          animation: kenburns-variant 20s ease-in-out infinite alternate;
        }
      `}</style>
    </div>
  );
}

export default HomePage;