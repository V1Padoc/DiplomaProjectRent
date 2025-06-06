// frontend/src/pages/HomePage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MagnifyingGlassIcon, HomeModernIcon, KeyIcon, ChatBubbleLeftRightIcon, BuildingStorefrontIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';

// Helper to construct image URLs, similar to other pages
const getListingImageUrl = (photoFilename) => {
    if (photoFilename) {
        // Assuming photoFilename is just the name like "image.jpg"
        return `http://localhost:5000/uploads/${photoFilename}`;
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
        const response = await axios.get('http://localhost:5000/api/listings?status=active&limit=5&sortBy=created_at&sortOrder=DESC');
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
      title: "Find Your Perfect Stay",
      description: "Easily search and filter through a wide variety of daily and monthly rentals. Your next home or getaway is just a few clicks away.",
      link: "/listings",
      linkText: "Browse Rentals"
    },
    {
      icon: <HomeModernIcon className="w-10 h-10 text-blue-600 mb-3" />,
      title: "List Your Property",
      description: "Reach thousands of potential tenants by listing your property. Our platform makes it simple to manage your rentals and bookings.",
      link: isAuthenticated && user?.role === 'owner' ? "/create-listing" : "/register?role=owner",
      linkText: "Become an Owner"
    },
    {
      icon: <ChatBubbleLeftRightIcon className="w-10 h-10 text-blue-600 mb-3" />,
      title: "Connect Directly",
      description: "Communicate seamlessly with property owners or tenants through our integrated chat system for inquiries and arrangements.",
      link: isAuthenticated ? "/my-chats" : "/login",
      linkText: "View Chats"
    },
    {
        icon: <MapPinIcon className="w-10 h-10 text-blue-600 mb-3" />,
        title: "Explore on the Map",
        description: "Visualize listings on an interactive map to find properties in your desired location with ease.",
        link: "/map-listings",
        linkText: "View Map"
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
            Discover Your Next Space
          </h1>
          <p className="text-lg sm:text-xl text-slate-200 mb-10 max-w-2xl mx-auto">
            Find unique places for short-term getaways or long-term stays. Rent out your property with confidence and ease.
          </p>
          <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter a city, neighborhood, or address..."
              className="form-input flex-grow w-full sm:w-auto rounded-lg border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 text-slate-900 placeholder-slate-400 py-3 px-4 text-base"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg text-base transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75"
            >
              <MagnifyingGlassIcon className="w-5 h-5 inline-block mr-2 -mt-1" /> Search
            </button>
          </form>
           <Link
            to="/listings"
            className="mt-8 inline-block text-blue-300 hover:text-blue-200 hover:underline transition-colors text-sm"
          >
            Or browse all listings »
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">
              A Platform Built for You
            </h2>
            <p className="text-slate-600 max-w-xl mx-auto text-lg">
              Whether you're looking for a place or offering one, we provide the tools you need.
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
              <h3 className="text-2xl font-bold text-slate-800 mb-3">Ready to Find Your Next Stay?</h3>
              <p className="text-slate-600 mb-6">
                Explore thousands of verified listings. Filter by location, price, amenities, and more.
              </p>
              <Link
                to="/listings"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg text-base transition-colors shadow-md"
              >
                Browse Properties
              </Link>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-xl text-center md:text-left">
              <KeyIcon className="w-12 h-12 text-green-600 mb-4 mx-auto md:mx-0"/>
              <h3 className="text-2xl font-bold text-slate-800 mb-3">Have a Property to List?</h3>
              <p className="text-slate-600 mb-6">
                Join our community of property owners. It's free to list and easy to manage.
              </p>
              <Link
                to={isAuthenticated && user?.role === 'owner' ? "/create-listing" : "/register?role=owner"}
                className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg text-base transition-colors shadow-md"
              >
                {isAuthenticated && user?.role === 'owner' ? "Create a Listing" : "List Your Property"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer (simple version) */}
      <footer className="py-8 bg-slate-800 text-slate-400 text-center">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm">© {new Date().getFullYear()} YourRentalSite. All rights reserved.</p>
           <p className="text-xs mt-1">
            <Link to="/listings" className="hover:text-slate-200 transition-colors">Browse</Link> |
            <Link to="/login" className="ml-2 hover:text-slate-200 transition-colors">Login</Link> |
            <Link to="/register" className="ml-2 hover:text-slate-200 transition-colors">Register</Link>
          </p>
        </div>
      </footer>

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