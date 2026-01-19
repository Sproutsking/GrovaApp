import React, { useState, useRef, useEffect } from 'react';
import { 
  X, ShoppingCart, DollarSign, List, Clock, Edit, Trash2, MessageSquare, 
  Check, AlertTriangle, Upload, ArrowLeft, User, Star, TrendingUp, Shield, 
  Award, Calendar, MessageSquare as SupportIcon, Search, Wallet, DollarSign as PaymentIcon, Coins as AssetIcon,
  ArrowBigLeft
} from 'lucide-react';

const TradeTab = ({ setActiveTab }) => {
  const [subTab, setSubTab] = useState('buy');
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [tradeInitiated, setTradeInitiated] = useState(false);
  const [tradeAmount, setTradeAmount] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showCreateAd, setShowCreateAd] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportMessage, setSupportMessage] = useState('');
  const [assetFilterOpen, setAssetFilterOpen] = useState(false);
  const [paymentFilterOpen, setPaymentFilterOpen] = useState(false);
  const [amountFilterOpen, setAmountFilterOpen] = useState(false);
  const assetFilterRef = useRef(null);
  const paymentFilterRef = useRef(null);
  const amountFilterRef = useRef(null);

  const [yourAds, setYourAds] = useState([
    { 
      id: 1, 
      type: 'sell', 
      amount: 200, 
      price: 2.6, 
      currency: 'NGN', 
      method: 'Bank Transfer', 
      min: 100, 
      max: 500, 
      status: 'active', 
      terms: '' 
    },
  ]);

  const [history, setHistory] = useState([
    { id: 1, type: 'buy', amount: 100, price: 2.5, currency: 'NGN', counterparty: 'User123', status: 'completed', date: '2026-01-03' },
    { id: 2, type: 'sell', amount: 50, price: 2.4, currency: 'NGN', counterparty: 'TraderX', status: 'in-progress', date: '2026-01-05' },
    { id: 3, type: 'buy', amount: 200, price: 1, currency: 'USDT', counterparty: 'BuyerA', status: 'canceled', date: '2025-12-30' },
  ]);

  const [createForm, setCreateForm] = useState({
    type: 'sell',
    amount: '',
    price: '',
    currency: 'NGN',
    method: 'Bank Transfer',
    min: '',
    max: '',
    status: 'active',
    terms: ''
  });

  const [editAd, setEditAd] = useState(null);

  const [filterCurrency, setFilterCurrency] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [filterMinAmount, setFilterMinAmount] = useState('');
  const [filterMaxAmount, setFilterMaxAmount] = useState('');

  const [userProfile, setUserProfile] = useState({
    name: 'TraderPro',
    bio: 'Professional trader with 2+ years experience. Fast and reliable transactions.',
    rating: 99,
    completion: '100%',
    trades: 50,
    joined: 'Jan 2023',
    verified: true,
    responseTime: '< 5 min',
    avatar: 'TP',
    email: 'trader@example.com',
    phone: '+234 xxx xxxx',
    preferredPayment: 'Bank Transfer',
    tradingHours: '9 AM - 10 PM',
    languages: 'English, Hausa',
    totalVolume: '125,000 GT'
  });

  const userBalance = { tokens: 1250 };

  const paymentMethods = [
    'Bank Transfer',
    'Mobile Money',
    'PayPal',
    'Crypto Wallet',
    'Cash App',
    'Venmo',
    'Zelle'
  ];

  const demoSellOffers = [
    {
      id: 1,
      seller: 'User123',
      sellerDetails: {
        rating: 99,
        completion: '98%',
        trades: 120,
        joined: 'Mar 2023',
        verified: true,
        responseTime: '< 3 min',
        bio: 'Experienced trader. Quick responses guaranteed.',
        avatar: 'U1',
        totalVolume: '250,000 GT',
        preferredPayment: 'Bank Transfer',
        tradingHours: '24/7',
        languages: 'English, French'
      },
      available: 500,
      price: 2.5,
      currency: 'NGN',
      method: 'Bank Transfer',
      min: 50,
      max: 300,
      status: 'active',
      terms: 'Payment within 30 minutes. Bank details will be provided.'
    },
    {
      id: 2,
      seller: 'TraderX',
      sellerDetails: {
        rating: 97,
        completion: '95%',
        trades: 80,
        joined: 'Jun 2023',
        verified: true,
        responseTime: '< 10 min',
        bio: 'Crypto enthusiast. Available 24/7.',
        avatar: 'TX',
        totalVolume: '180,000 GT',
        preferredPayment: 'Crypto Wallet',
        tradingHours: 'Flexible',
        languages: 'English'
      },
      available: 1000,
      price: 1,
      currency: 'USDT',
      method: 'Crypto Wallet',
      min: 100,
      max: 500,
      status: 'idle',
      terms: 'Send to provided wallet address.'
    },
    {
      id: 5,
      seller: 'FastTrade',
      sellerDetails: {
        rating: 98,
        completion: '99%',
        trades: 200,
        joined: 'Jan 2023',
        verified: true,
        responseTime: '< 2 min',
        bio: 'Lightning fast trades. Professional service.',
        avatar: 'FT',
        totalVolume: '500,000 GT',
        preferredPayment: 'Mobile Money',
        tradingHours: '8 AM - 11 PM',
        languages: 'English, Yoruba, Igbo'
      },
      available: 750,
      price: 2.55,
      currency: 'NGN',
      method: 'Mobile Money',
      min: 50,
      max: 400,
      status: 'active',
      terms: 'Mobile money transfer only. Fast release.'
    },
  ];

  const demoBuyOffers = [
    {
      id: 3,
      buyer: 'BuyerA',
      buyerDetails: {
        rating: 98,
        completion: '99%',
        trades: 90,
        joined: 'Apr 2023',
        verified: true,
        responseTime: '< 5 min',
        bio: 'Regular buyer. Instant payments.',
        avatar: 'BA',
        totalVolume: '200,000 GT',
        preferredPayment: 'Mobile Money',
        tradingHours: '9 AM - 9 PM',
        languages: 'English, Hausa'
      },
      wanted: 300,
      price: 2.4,
      currency: 'NGN',
      method: 'Mobile Money',
      min: 50,
      max: 200,
      status: 'active',
      terms: 'Release tokens after payment confirmation.'
    },
    {
      id: 4,
      buyer: 'InvestorB',
      buyerDetails: {
        rating: 96,
        completion: '97%',
        trades: 60,
        joined: 'May 2023',
        verified: false,
        responseTime: '< 15 min',
        bio: 'Long-term investor. Serious buyers only.',
        avatar: 'IB',
        totalVolume: '150,000 GT',
        preferredPayment: 'PayPal',
        tradingHours: '10 AM - 6 PM',
        languages: 'English'
      },
      wanted: 600,
      price: 0.95,
      currency: 'USDT',
      method: 'PayPal',
      min: 100,
      max: 400,
      status: 'inactive',
      terms: 'PayPal payment. May take longer.'
    },
  ];

  const filteredOffers = (offers) => offers.filter((offer) => {
    const currencyMatch = filterCurrency ? offer.currency === filterCurrency : true;
    const methodMatch = filterMethod ? offer.method === filterMethod : true;
    const amountKey = offer.available !== undefined ? 'available' : 'wanted';
    const amount = offer[amountKey];
    const minMatch = filterMinAmount ? amount >= parseFloat(filterMinAmount) : true;
    const maxMatch = filterMaxAmount ? amount <= parseFloat(filterMaxAmount) : true;
    return currencyMatch && methodMatch && minMatch && maxMatch;
  });

  const filteredHistory = history.filter((trade) => {
    if (historyFilter === 'all') return true;
    return trade.status === historyFilter;
  });

  const handleSelectOffer = (offer) => {
    setSelectedOffer(offer);
    setTradeAmount('');
    setChatMessages([{ sender: 'system', text: 'Trade initiated. Discuss terms with your counterparty.' }]);
  };

  const handleInitiateTrade = () => {
    const amount = parseFloat(tradeAmount);
    const available = subTab === 'buy' ? selectedOffer.available : selectedOffer.wanted;

    if (isNaN(amount) || amount < selectedOffer.min || amount > selectedOffer.max || amount > available) {
      alert('Invalid amount. Check limits and availability.');
      return;
    }
    if (subTab === 'sell' && amount > userBalance.tokens) {
      alert('Insufficient GT balance.');
      return;
    }
    setTradeInitiated(true);
  };

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      setChatMessages([...chatMessages, { sender: 'you', text: newMessage }]);
      setNewMessage('');
      setTimeout(() => {
        setChatMessages((prev) => [...prev, { sender: 'counterparty', text: 'Message received. Processing...' }]);
      }, 1000);
    }
  };

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setChatMessages([...chatMessages, { sender: 'you', text: `📎 ${file.name}`, type: 'file' }]);
    }
  };

  const handleConfirm = (asBuyer) => {
    const trade = {
      id: Date.now(),
      type: subTab,
      amount: parseFloat(tradeAmount),
      price: selectedOffer.price,
      currency: selectedOffer.currency,
      counterparty: subTab === 'buy' ? selectedOffer.seller : selectedOffer.buyer,
      status: 'completed',
      date: new Date().toISOString().split('T')[0]
    };
    setHistory([trade, ...history]);
    setChatOpen(false);
    setSelectedOffer(null);
    setTradeInitiated(false);
    setTradeAmount('');
    alert(`${asBuyer ? 'Payment confirmed' : 'Funds released'}. Trade completed successfully!`);
  };

  const handleCreateOrEditAd = () => {
    if (!createForm.amount || !createForm.price || !createForm.min || !createForm.max) {
      alert('Please fill all required fields.');
      return;
    }

    const ad = {
      ...createForm,
      id: editAd ? editAd.id : Date.now(),
      amount: parseFloat(createForm.amount),
      price: parseFloat(createForm.price),
      min: parseFloat(createForm.min),
      max: parseFloat(createForm.max)
    };

    if (editAd) {
      setYourAds(yourAds.map((a) => (a.id === editAd.id ? ad : a)));
    } else {
      setYourAds([ad, ...yourAds]);
    }

    setCreateForm({
      type: 'sell',
      amount: '',
      price: '',
      currency: 'NGN',
      method: 'Bank Transfer',
      min: '',
      max: '',
      status: 'active',
      terms: ''
    });
    setEditAd(null);
    setShowCreateAd(false);
  };

  const handleDeleteAd = (id) => {
    if (window.confirm('Are you sure you want to delete this ad?')) {
      setYourAds(yourAds.filter((a) => a.id !== id));
    }
  };

  const handleEditAd = (ad) => {
    setEditAd(ad);
    setCreateForm(ad);
    setShowCreateAd(true);
  };

  const handleToggleAdStatus = (id) => {
    setYourAds(yourAds.map(ad =>
      ad.id === id
        ? { ...ad, status: ad.status === 'active' ? 'inactive' : 'active' }
        : ad
    ));
  };

  const handleUpdateProfile = () => {
    setShowEditProfile(false);
    alert('Profile updated successfully!');
  };

  const handleSendSupportMessage = () => {
    if (supportMessage.trim()) {
      setSupportMessages([...supportMessages, { sender: 'you', text: supportMessage, time: new Date().toLocaleTimeString() }]);
      setSupportMessage('');
      setTimeout(() => {
        setSupportMessages((prev) => [...prev, {
          sender: 'support',
          text: 'Thank you for contacting support. A representative will assist you shortly.',
          time: new Date().toLocaleTimeString()
        }]);
      }, 1000);
    }
  };

  const counterpartyDetails = selectedOffer 
    ? (subTab === 'buy' ? selectedOffer.sellerDetails : selectedOffer.buyerDetails)
    : null;
  const counterpartyName = selectedOffer 
    ? (subTab === 'buy' ? selectedOffer.seller : selectedOffer.buyer)
    : '';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (assetFilterRef.current && !assetFilterRef.current.contains(event.target)) {
        setAssetFilterOpen(false);
      }
      if (paymentFilterRef.current && !paymentFilterRef.current.contains(event.target)) {
        setPaymentFilterOpen(false);
      }
      if (amountFilterRef.current && !amountFilterRef.current.contains(event.target)) {
        setAmountFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const ProfileModal = ({ profile, name, onClose }) => (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="profile-modal-close" onClick={onClose}>
          <ArrowBigLeft size={20} />
        </button>

        <div className="profile-modal-header">
          <div className="profile-avatar-large">{profile.avatar}</div>
          <div className="profile-modal-info">
            <div className="profile-name-badge">
              <h3>{name}</h3>
              {profile.verified && <Shield size={16} className="verified-badge" />}
            </div>
            <div className="profile-stats-row">
              <div className="profile-stat">
                <Star size={14} fill="#fbbf24" stroke="#fbbf24" />
                <span>{profile.rating}%</span>
              </div>
              <div className="profile-stat">
                <TrendingUp size={14} />
                <span>{profile.trades} trades</span>
              </div>
              <div className="profile-stat">
                <Award size={14} />
                <span>{profile.completion}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-modal-details">
          <div className="profile-detail-item">
            <Calendar size={16} />
            <span>Joined {profile.joined}</span>
          </div>
          <div className="profile-detail-item">
            <Clock size={16} />
            <span>Response time: {profile.responseTime}</span>
          </div>
        </div>

        <div className="profile-modal-bio">
          <h4>About</h4>
          <p>{profile.bio}</p>
        </div>

        <div className="profile-modal-extended">
          <div className="profile-info-card">
            <h4>Total Volume</h4>
            <p>{profile.totalVolume || 'N/A'}</p>
          </div>
          <div className="profile-info-card">
            <h4>Preferred Payment</h4>
            <p>{profile.preferredPayment || 'Various'}</p>
          </div>
          <div className="profile-info-card">
            <h4>Trading Hours</h4>
            <p>{profile.tradingHours || 'Flexible'}</p>
          </div>
          <div className="profile-info-card">
            <h4>Languages</h4>
            <p>{profile.languages || 'English'}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`trade-container ${selectedOffer ? 'full-screen' : ''}`} style={{ zIndex: 1000 }}>

      {/* Header */}
      <div className="trade-header">
        <div className="header-left">
          <button onClick={() => setActiveTab('overview')} className="back-btn">
            < ArrowBigLeft size={20} />
          </button>
        </div>
        {/* Filters - Shown on Buy, Sell, History */}
      {(subTab === 'buy' || subTab === 'sell' || subTab === 'history') && !selectedOffer && (
        <div className="trade-filters">
          <div className="filter-row">
            <div className="filter-button" ref={assetFilterRef} onClick={() => setAssetFilterOpen(!assetFilterOpen)}>
              <AssetIcon size={18} />
              {assetFilterOpen && (
                <div className="filter-dropdown">
                  <div className={`filter-option ${filterCurrency === '' ? 'active' : ''}`} onClick={() => {
                    setFilterCurrency('');
                    setAssetFilterOpen(false);
                  }}>
                    All Assets
                  </div>
                  <div className={`filter-option ${filterCurrency === 'NGN' ? 'active' : ''}`} onClick={() => {
                    setFilterCurrency('NGN');
                    setAssetFilterOpen(false);
                  }}>
                    NGN
                  </div>
                  <div className={`filter-option ${filterCurrency === 'USDT' ? 'active' : ''}`} onClick={() => {
                    setFilterCurrency('USDT');
                    setAssetFilterOpen(false);
                  }}>
                    USDT
                  </div>
                </div>
              )}
            </div>
            {(subTab === 'buy' || subTab === 'sell') && (
              <div className="filter-button" ref={paymentFilterRef} onClick={() => setPaymentFilterOpen(!paymentFilterOpen)}>
                <PaymentIcon size={18} />
                {paymentFilterOpen && (
                  <div className="filter-dropdown">
                    <div className={`filter-option ${filterMethod === '' ? 'active' : ''}`} onClick={() => {
                      setFilterMethod('');
                      setPaymentFilterOpen(false);
                    }}>
                      All Methods
                    </div>
                    {paymentMethods.map((method) => (
                      <div key={method} className={`filter-option ${filterMethod === method ? 'active' : ''}`} onClick={() => {
                        setFilterMethod(method);
                        setPaymentFilterOpen(false);
                      }}>
                        {method}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {(subTab === 'buy' || subTab === 'sell') && (
              <div className="filter-button" ref={amountFilterRef} onClick={() => setAmountFilterOpen(!amountFilterOpen)}>
                <Search size={18} />
                {amountFilterOpen && (
                  <div className="filter-dropdown">
                    <div className="amount-filter-row">
                      <input
                        type="number"
                        className="amount-filter-input"
                        placeholder="Min (GT)"
                        value={filterMinAmount}
                        onChange={(e) => setFilterMinAmount(e.target.value)}
                      />
                      <input
                        type="number"
                        className="amount-filter-input"
                        placeholder="Max (GT)"
                        value={filterMaxAmount}
                        onChange={(e) => setFilterMaxAmount(e.target.value)}
                      />
                    </div>
                    <button className="amount-filter-button" onClick={() => setAmountFilterOpen(false)}>
                      Apply
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
        <button onClick={() => setShowSupportModal(true)} className="support-btn">
          <SupportIcon size={20} />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="trade-quick-actions">
        <button className={`trade-tab-btn ${subTab === 'buy' ? 'active' : ''}`} onClick={() => setSubTab('buy')}>
          <ShoppingCart size={18} /> Buy
        </button>
        <button className={`trade-tab-btn ${subTab === 'sell' ? 'active' : ''}`} onClick={() => setSubTab('sell')}>
          <DollarSign size={18} /> Sell
        </button>
        <button className={`trade-tab-btn ${subTab === 'manage' ? 'active' : ''}`} onClick={() => setSubTab('manage')}>
          <List size={18} /> Manage
        </button>
        <button className={`trade-tab-btn ${subTab === 'history' ? 'active' : ''}`} onClick={() => setSubTab('history')}>
          <Clock size={18} /> History
        </button>
      </div>

      {/* Main Content */}
      {!selectedOffer && !tradeInitiated && (
        <div className="trade-content">
          {/* Buy Tab */}
          {subTab === 'buy' && (
            <div className="trade-section">

              <div className="trade-offers-list">
                {filteredOffers(demoSellOffers).length > 0 ? (
                  filteredOffers(demoSellOffers).map((offer) => (
                    <div key={offer.id} className="trade-offer-card">
                      <div className="offer-header">
                        <div
                          className="offer-avatar"
                          onClick={() => setShowProfileModal({ profile: offer.sellerDetails, name: offer.seller })}
                        >
                          {offer.sellerDetails.avatar}
                        </div>
                        <div className="offer-user-info">
                          <div className="offer-user-name">
                            {offer.seller}
                            {offer.sellerDetails.verified && <Shield size={14} className="verified-badge" />}
                            <span className={`status-indicator ${offer.status}`}></span>
                          </div>
                          <div className="offer-user-stats">
                            <div className="offer-stat">
                              <Star size={12} fill="#fbbf24" stroke="#fbbf24" />
                              {offer.sellerDetails.rating}%
                            </div>
                            <div className="offer-stat">{offer.sellerDetails.trades} trades</div>
                            <div className="offer-stat">
                              <Clock size={12} />
                              {offer.sellerDetails.responseTime}
                            </div>
                          </div>
                        </div>
                        <div className="offer-price-section">
                          <div className="offer-price">{offer.price} {offer.currency}</div>
                          <div className="offer-currency">per GT</div>
                        </div>
                        <button className="btn-buy" onClick={() => handleSelectOffer(offer)}>
                          <ShoppingCart size={14} /> BUY
                        </button>
                      </div>
                      <div className="offer-body">
                        <div className="offer-details">
                          <div className="offer-detail"><strong>Available</strong><span>{offer.available} GT</span></div>
                          <div className="offer-detail"><strong>Limits</strong><span>{offer.min}-{offer.max} GT</span></div>
                          <div className="offer-detail"><strong>Method</strong><span>{offer.method}</span></div>
                          <div className="offer-detail"><strong>Time Limit</strong><span>30 min</span></div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <ShoppingCart size={48} className="empty-state-icon" />
                    <p>No offers match your filters</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sell Tab */}
          {subTab === 'sell' && (
            <div className="trade-section">
              <h3 className="trade-section-title">
                <DollarSign size={20} /> Available Buy Offers
              </h3>
              <div className="trade-offers-list">
                {filteredOffers(demoBuyOffers).length > 0 ? (
                  filteredOffers(demoBuyOffers).map((offer) => (
                    <div key={offer.id} className="trade-offer-card">
                      <div className="offer-header">
                        <div
                          className="offer-avatar"
                          onClick={() => setShowProfileModal({ profile: offer.buyerDetails, name: offer.buyer })}
                        >
                          {offer.buyerDetails.avatar}
                        </div>
                        <div className="offer-user-info">
                          <div className="offer-user-name">
                            {offer.buyer}
                            {offer.buyerDetails.verified && <Shield size={14} className="verified-badge" />}
                            <span className={`status-indicator ${offer.status}`}></span>
                          </div>
                          <div className="offer-user-stats">
                            <div className="offer-stat">
                              <Star size={12} fill="#fbbf24" stroke="#fbbf24" />
                              {offer.buyerDetails.rating}%
                            </div>
                            <div className="offer-stat">{offer.buyerDetails.trades} trades</div>
                            <div className="offer-stat">
                              <Clock size={12} />
                              {offer.buyerDetails.responseTime}
                            </div>
                          </div>
                        </div>
                        <div className="offer-price-section">
                          <div className="offer-price">{offer.price} {offer.currency}</div>
                          <div className="offer-currency">per GT</div>
                        </div>
                        <button className="btn-sell" onClick={() => handleSelectOffer(offer)}>
                          <DollarSign size={14} /> SELL
                        </button>
                      </div>
                      <div className="offer-body">
                        <div className="offer-details">
                          <div className="offer-detail"><strong>Wants</strong><span>{offer.wanted} GT</span></div>
                          <div className="offer-detail"><strong>Limits</strong><span>{offer.min}-{offer.max} GT</span></div>
                          <div className="offer-detail"><strong>Method</strong><span>{offer.method}</span></div>
                          <div className="offer-detail"><strong>Time Limit</strong><span>30 min</span></div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <DollarSign size={48} className="empty-state-icon" />
                    <p>No offers match your filters</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manage Tab */}
          {subTab === 'manage' && (
            <>
              <div className="profile-edit-section">
                <div className="profile-edit-header">
                  <h3 className="trade-section-title">
                    <User size={20} /> Your Trading Profile
                  </h3>
                  <button className="btn-edit" onClick={() => setShowEditProfile(!showEditProfile)}>
                    {showEditProfile ? 'Cancel' : 'Edit Profile'}
                  </button>
                </div>

                {!showEditProfile ? (
                  <div className="profile-display">
                    <div className="profile-display-avatar">{userProfile.avatar}</div>
                    <div className="profile-display-info">
                      <h3>{userProfile.name}</h3>
                      <p className="profile-display-bio">{userProfile.bio}</p>
                      <div className="profile-display-stats">
                        <span><Star size={12} fill="#fbbf24" stroke="#fbbf24" /> {userProfile.rating}%</span>
                        <span>{userProfile.trades} trades</span>
                        <span>{userProfile.completion} completion</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="trade-form">
                    <div className="form-group">
                      <label className="form-label">Display Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={userProfile.name}
                        onChange={(e) => setUserProfile({ ...userProfile, name: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Avatar Initials</label>
                      <input
                        type="text"
                        className="form-input"
                        value={userProfile.avatar}
                        onChange={(e) => setUserProfile({ ...userProfile, avatar: e.target.value.slice(0, 2).toUpperCase() })}
                        maxLength={2}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Bio</label>
                      <textarea
                        className="form-textarea"
                        value={userProfile.bio}
                        onChange={(e) => setUserProfile({ ...userProfile, bio: e.target.value })}
                        placeholder="Tell traders about yourself..."
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-input"
                        value={userProfile.email}
                        onChange={(e) => setUserProfile({ ...userProfile, email: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone</label>
                      <input
                        type="tel"
                        className="form-input"
                        value={userProfile.phone}
                        onChange={(e) => setUserProfile({ ...userProfile, phone: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Preferred Payment</label>
                      <select
                        className="form-select"
                        value={userProfile.preferredPayment}
                        onChange={(e) => setUserProfile({ ...userProfile, preferredPayment: e.target.value })}
                      >
                        {paymentMethods.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Trading Hours</label>
                      <input
                        type="text"
                        className="form-input"
                        value={userProfile.tradingHours}
                        onChange={(e) => setUserProfile({ ...userProfile, tradingHours: e.target.value })}
                        placeholder="e.g. 9 AM - 10 PM"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Languages</label>
                      <input
                        type="text"
                        className="form-input"
                        value={userProfile.languages}
                        onChange={(e) => setUserProfile({ ...userProfile, languages: e.target.value })}
                        placeholder="e.g. English, Hausa"
                      />
                    </div>
                    <button className="btn-primary" onClick={handleUpdateProfile}>
                      Save Profile
                    </button>
                  </div>
                )}
              </div>

              <div className="trade-section">
                <h3 className="trade-section-title">
                  <List size={20} /> Your Ads ({yourAds.length})
                </h3>
                <div className="trade-offers-list">
                  {yourAds.map((ad) => (
                    <div key={ad.id} className="ad-card">
                      <div className="ad-header">
                        <div className={`ad-type ${ad.type}`}>
                          {ad.type === 'sell' ? <DollarSign size={16} /> : <ShoppingCart size={16} />}
                          {ad.type.toUpperCase()} AD
                        </div>
                        <div className="ad-actions">
                          <button
                            className={`ad-status-toggle ${ad.status}`}
                            onClick={() => handleToggleAdStatus(ad.id)}
                          >
                            {ad.status === 'active' ? 'Active' : 'Inactive'}
                          </button>
                          <button className="icon-btn" onClick={() => handleEditAd(ad)}>
                            <Edit size={16} />
                          </button>
                          <button className="icon-btn delete" onClick={() => handleDeleteAd(ad.id)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="ad-details">
                        <div className="ad-detail"><strong>Price:</strong> {ad.price} {ad.currency}/GT</div>
                        <div className="ad-detail"><strong>Amount:</strong> {ad.amount} GT</div>
                        <div className="ad-detail"><strong>Method:</strong> {ad.method}</div>
                        <div className="ad-detail"><strong>Limits:</strong> {ad.min}-{ad.max} GT</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {!showCreateAd && !editAd && (
                <div className="create-ad-section">
                  <button className="btn-create-ad" onClick={() => setShowCreateAd(true)}>
                    <span style={{ fontSize: '24px' }}>+</span> Create New Ad
                  </button>
                </div>
              )}

              {(showCreateAd || editAd) && (
                <div className="trade-section">
                  <h3 className="trade-section-title">
                    {editAd ? 'Edit Ad' : 'Create New Ad'}
                  </h3>
                  <div className="trade-form">
                    <div className="form-group">
                      <label className="form-label">Ad Type</label>
                      <select
                        className="form-select"
                        value={createForm.type}
                        onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                      >
                        <option value="sell">Sell GT</option>
                        <option value="buy">Buy GT</option>
                      </select>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Total Amount (GT)</label>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="0"
                          value={createForm.amount}
                          onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Price per GT</label>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="0.00"
                          value={createForm.price}
                          onChange={(e) => setCreateForm({ ...createForm, price: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Currency</label>
                        <select
                          className="form-select"
                          value={createForm.currency}
                          onChange={(e) => setCreateForm({ ...createForm, currency: e.target.value })}
                        >
                          <option value="NGN">NGN</option>
                          <option value="USDT">USDT</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Payment Method</label>
                        <select
                          className="form-select"
                          value={createForm.method}
                          onChange={(e) => setCreateForm({ ...createForm, method: e.target.value })}
                        >
                          {paymentMethods.map((method) => (
                            <option key={method} value={method}>{method}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Min per Trade (GT)</label>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="0"
                          value={createForm.min}
                          onChange={(e) => setCreateForm({ ...createForm, min: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Max per Trade (GT)</label>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="0"
                          value={createForm.max}
                          onChange={(e) => setCreateForm({ ...createForm, max: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Terms & Conditions (Optional)</label>
                      <textarea
                        className="form-textarea"
                        value={createForm.terms}
                        onChange={(e) => setCreateForm({ ...createForm, terms: e.target.value })}
                        placeholder="Add any specific terms for this trade..."
                      />
                    </div>
                    <div className="form-actions">
                      <button className="btn-primary" onClick={handleCreateOrEditAd}>
                        {editAd ? 'Update Ad' : 'Create Ad'}
                      </button>
                      <button className="btn-secondary" onClick={() => {
                        setEditAd(null);
                        setShowCreateAd(false);
                        setCreateForm({
                          type: 'sell',
                          amount: '',
                          price: '',
                          currency: 'NGN',
                          method: 'Bank Transfer',
                          min: '',
                          max: '',
                          status: 'active',
                          terms: ''
                        });
                      }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* History Tab */}
          {subTab === 'history' && (
            <div className="trade-section">
              <h3 className="trade-section-title">
                <Clock size={20} /> Trade History
              </h3>
              <div className="history-filter-buttons">
                <button className={`history-filter-btn ${historyFilter === 'all' ? 'active' : ''}`} onClick={() => setHistoryFilter('all')}>
                  All
                </button>
                <button className={`history-filter-btn ${historyFilter === 'completed' ? 'active' : ''}`} onClick={() => setHistoryFilter('completed')}>
                  Completed
                </button>
                <button className={`history-filter-btn ${historyFilter === 'in-progress' ? 'active' : ''}`} onClick={() => setHistoryFilter('in-progress')}>
                  In Progress
                </button>
                <button className={`history-filter-btn ${historyFilter === 'canceled' ? 'active' : ''}`} onClick={() => setHistoryFilter('canceled')}>
                  Canceled
                </button>
              </div>
              <div className="trade-offers-list">
                {filteredHistory.length > 0 ? (
                  filteredHistory.map((trade) => (
                    <div key={trade.id} className="history-card">
                      <div className="history-header">
                        <div className={`history-type ${trade.type}`}>
                          {trade.type === 'buy' ? <ShoppingCart size={16} /> : <DollarSign size={16} />}
                          {trade.type.toUpperCase()} {trade.amount} GT
                        </div>
                        <div className={`history-status ${trade.status}`}>
                          {trade.status === 'in-progress' ? 'In Progress' : trade.status.charAt(0).toUpperCase() + trade.status.slice(1)}
                        </div>
                      </div>
                      <div className="history-details">
                        <strong>Price:</strong> {trade.price} {trade.currency}/GT<br />
                        <strong>Total:</strong> {(trade.amount * trade.price).toFixed(2)} {trade.currency}<br />
                        <strong>Counterparty:</strong> {trade.counterparty}<br />
                        <strong>Date:</strong> {trade.date}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <Clock size={48} className="empty-state-icon" />
                    <p>No trades found</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Offer Selected - Initiate Trade */}
      {selectedOffer && !tradeInitiated && (
        <div className="trade-summary-interface">
          <div className="trade-header">
            <button className="back-btn" onClick={() => setSelectedOffer(null)}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="view-title">Initiate Trade</h2>
              <p className="view-subtitle">Review details and start trading</p>
            </div>
            <button className="back-btn" onClick={() => setChatOpen(true)}>
              <MessageSquare size={20} />
            </button>
          </div>

          <div
            className="summary-card"
            onClick={() => setShowProfileModal({ profile: counterpartyDetails, name: counterpartyName })}
            style={{ cursor: 'pointer' }}
          >
            <div className="offer-header">
              <div className="offer-avatar">{counterpartyDetails?.avatar}</div>
              <div className="offer-user-info">
                <div className="offer-user-name">
                  {counterpartyName}
                  {counterpartyDetails?.verified && <Shield size={14} className="verified-badge" />}
                </div>
                <div className="offer-user-stats">
                  <div className="offer-stat">
                    <Star size={12} fill="#fbbf24" stroke="#fbbf24" />
                    {counterpartyDetails?.rating}%
                  </div>
                  <div className="offer-stat">{counterpartyDetails?.trades} trades</div>
                  <div className="offer-stat">
                    <Clock size={12} />
                    {counterpartyDetails?.responseTime}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="summary-card">
            <h3 className="summary-title">Trade Details</h3>
            <div className="summary-details">
              <div className="summary-detail">
                <span className="summary-detail-label">Type</span>
                <span className="summary-detail-value" style={{ color: subTab === 'buy' ? '#22c55e' : '#ef4444' }}>
                  {subTab.toUpperCase()}
                </span>
              </div>
              <div className="summary-detail">
                <span className="summary-detail-label">Price per GT</span>
                <span className="summary-detail-value">{selectedOffer.price} {selectedOffer.currency}</span>
              </div>
              <div className="summary-detail">
                <span className="summary-detail-label">{subTab === 'buy' ? 'Available' : 'Wanted'}</span>
                <span className="summary-detail-value">{subTab === 'buy' ? selectedOffer.available : selectedOffer.wanted} GT</span>
              </div>
              <div className="summary-detail">
                <span className="summary-detail-label">Trade Limits</span>
                <span className="summary-detail-value">{selectedOffer.min} - {selectedOffer.max} GT</span>
              </div>
              <div className="summary-detail">
                <span className="summary-detail-label">Payment Method</span>
                <span className="summary-detail-value">{selectedOffer.method}</span>
              </div>
              {selectedOffer.terms && (
                <div className="summary-detail" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span className="summary-detail-label">Terms</span>
                  <span className="summary-detail-value" style={{ fontSize: '13px', marginTop: '4px' }}>
                    {selectedOffer.terms}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="amount-input-group">
            <label className="amount-label">Enter Amount (GT)</label>
            <input
              type="number"
              className="amount-input"
              value={tradeAmount}
              onChange={(e) => setTradeAmount(e.target.value)}
              placeholder={`Min: ${selectedOffer.min}, Max: ${selectedOffer.max}`}
            />
            {tradeAmount && !isNaN(parseFloat(tradeAmount)) && (
              <div style={{ marginTop: '12px', fontSize: '14px', color: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Cost:</span>
                  <span style={{ fontWeight: '700' }}>
                    {(parseFloat(tradeAmount) * selectedOffer.price).toFixed(2)} {selectedOffer.currency}
                  </span>
                </div>
                {subTab === 'sell' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#737373' }}>
                    <span>Your Balance:</span>
                    <span>{userBalance.tokens} GT</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            className={subTab === 'buy' ? 'btn-buy' : 'btn-sell'}
            onClick={handleInitiateTrade}
            disabled={!tradeAmount || isNaN(parseFloat(tradeAmount))}
            style={{ width: '100%', opacity: tradeAmount ? 1 : 0.5 }}
          >
            {subTab === 'buy' ? 'Initiate Buy' : 'Initiate Sell'}
          </button>
        </div>
      )}

      {/* Trade In Progress */}
      {tradeInitiated && selectedOffer && (
        <div className="trade-summary-interface">
          <div className="trade-header">
            <button className="back-btn" onClick={() => {
              setTradeInitiated(false);
              setSelectedOffer(null);
              setTradeAmount('');
            }}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="view-title">Ongoing Trade</h2>
              <p className="view-subtitle">Complete the transaction</p>
            </div>
            <button className="back-btn" onClick={() => setChatOpen(true)}>
              <MessageSquare size={20} />
            </button>
          </div>

          <div className="summary-card" style={{ background: 'rgba(132, 204, 22, 0.1)', borderColor: 'rgba(132, 204, 22, 0.3)' }}>
            <h3 className="summary-title" style={{ color: '#84cc16' }}>🔄 Trade In Progress</h3>
            <div className="summary-details">
              <div className="summary-detail">
                <span className="summary-detail-label">Trading with</span>
                <span className="summary-detail-value">{counterpartyName}</span>
              </div>
              <div className="summary-detail">
                <span className="summary-detail-label">Amount</span>
                <span className="summary-detail-value">{tradeAmount} GT</span>
              </div>
              <div className="summary-detail">
                <span className="summary-detail-label">Price</span>
                <span className="summary-detail-value">{selectedOffer.price} {selectedOffer.currency}/GT</span>
              </div>
              <div className="summary-detail">
                <span className="summary-detail-label">Total</span>
                <span className="summary-detail-value" style={{ fontSize: '18px', color: '#84cc16' }}>
                  {(parseFloat(tradeAmount) * selectedOffer.price).toFixed(2)} {selectedOffer.currency}
                </span>
              </div>
              <div className="summary-detail">
                <span className="summary-detail-label">Method</span>
                <span className="summary-detail-value">{selectedOffer.method}</span>
              </div>
            </div>
          </div>

          <div className="summary-card">
            <h3 className="summary-title">
              {subTab === 'buy' ? 'Instructions for Buyer' : 'Instructions for Seller'}
            </h3>
            <div style={{ fontSize: '14px', color: '#fff', lineHeight: '1.6' }}>
              {subTab === 'buy' ? (
                <>
                  <p style={{ marginBottom: '12px' }}>
                    1. Send <strong>{(parseFloat(tradeAmount) * selectedOffer.price).toFixed(2)} {selectedOffer.currency}</strong> using <strong>{selectedOffer.method}</strong>
                  </p>
                  <p style={{ marginBottom: '12px' }}>
                    2. Get payment details from the seller in chat
                  </p>
                  <p style={{ marginBottom: '12px' }}>
                    3. After sending, click "Confirm Payment Sent"
                  </p>
                  <p style={{ color: '#737373', fontSize: '13px' }}>
                    ⚠️ Seller will release GT after confirming payment
                  </p>
                </>
              ) : (
                <>
                  <p style={{ marginBottom: '12px' }}>
                    1. Share your payment details in chat
                  </p>
                  <p style={{ marginBottom: '12px' }}>
                    2. Wait for buyer to send <strong>{(parseFloat(tradeAmount) * selectedOffer.price).toFixed(2)} {selectedOffer.currency}</strong>
                  </p>
                  <p style={{ marginBottom: '12px' }}>
                    3. Confirm payment in your account
                  </p>
                  <p style={{ marginBottom: '12px' }}>
                    4. Click "Confirm Payment Received & Release GT"
                  </p>
                  <p style={{ color: '#737373', fontSize: '13px' }}>
                    ⚠️ Only release after payment is confirmed
                  </p>
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {subTab === 'buy' ? (
              <button className="btn-buy" onClick={() => handleConfirm(true)} style={{ width: '100%' }}>
                <Check size={16} /> Confirm Payment Sent
              </button>
            ) : (
              <button className="btn-primary" onClick={() => handleConfirm(false)} style={{ width: '100%' }}>
                <Check size={16} /> Confirm Payment Received & Release GT
              </button>
            )}
            <button
              className="btn-secondary"
              style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
            >
              <AlertTriangle size={16} /> Open Dispute
            </button>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {chatOpen && (
        <div className="trade-chat-modal">
          <div className="chat-header">
            <button className="back-btn" onClick={() => setChatOpen(false)}>
              <ArrowLeft size={20} />
            </button>
            <div className="chat-user-info">
              <div className="chat-user-name">{counterpartyName}</div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#737373' }}>
                <span><Star size={12} fill="#fbbf24" stroke="#fbbf24" /> {counterpartyDetails?.rating}%</span>
                <span>{counterpartyDetails?.trades} trades</span>
              </div>
            </div>
          </div>
          <div className="chat-messages-container">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.sender}`}>
                {msg.text}
              </div>
            ))}
          </div>
          <div className="chat-input-container">
            <label className="chat-upload-btn">
              <Upload size={18} />
              <input type="file" onChange={handleUpload} hidden />
            </label>
            <input
              type="text"
              className="chat-input"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type a message..."
            />
            <button className="chat-send-btn" onClick={handleSendMessage}>
              Send
            </button>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <ProfileModal
          profile={showProfileModal.profile}
          name={showProfileModal.name}
          onClose={() => setShowProfileModal(null)}
        />
      )}

      {/* Support Modal */}
      {showSupportModal && (
        <div className="support-modal">
          <div className="support-header">
            <button className="back-btn" onClick={() => setShowSupportModal(false)}>
              <ArrowLeft size={20} />
            </button>
            <div className="support-title">
              <h3>Support Chat</h3>
              <p>Talk to our support team</p>
            </div>
          </div>
          <div className="support-messages-container">
            {supportMessages.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#737373', marginTop: '50px' }}>
                Start a conversation with support
              </p>
            ) : (
              supportMessages.map((msg, idx) => (
                <div key={idx} className={`support-message ${msg.sender}`}>
                  {msg.text}
                  <div className="support-message-time">{msg.time}</div>
                </div>
              ))
            )}
          </div>
          <div className="support-input-container">
            <input
              type="text"
              className="support-input"
              value={supportMessage}
              onChange={(e) => setSupportMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendSupportMessage()}
              placeholder="Type your message..."
            />
            <button className="support-send-btn" onClick={handleSendSupportMessage}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeTab;