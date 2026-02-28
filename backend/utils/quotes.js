// Categorized motivational quotes for dashboard
const quotes = {
  leadership: [
    { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs", icon: "fas fa-briefcase" },
    { quote: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs", icon: "fas fa-lightbulb" },
    { quote: "Leadership is not about being in charge. It's about taking care of those in your charge.", author: "Simon Sinek", icon: "fas fa-handshake" },
    { quote: "A leader is one who knows the way, goes the way, and shows the way.", author: "John Maxwell", icon: "fas fa-bullseye" },
    { quote: "The greatest leader is not necessarily the one who does the greatest things. He is the one that gets the people to do the greatest things.", author: "Ronald Reagan", icon: "fas fa-star" },
    { quote: "Excellence is never an accident. It is always the result of high intention, sincere effort, and intelligent execution.", author: "A.P.J. Abdul Kalam", icon: "fas fa-trophy" },
    { quote: "Before you are a leader, success is all about growing yourself. When you become a leader, success is all about growing others.", author: "Jack Welch", icon: "fas fa-seedling" },
    { quote: "The function of leadership is to produce more leaders, not more followers.", author: "Ralph Nader", icon: "fas fa-users" }
  ],
  
  motivation: [
    { quote: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs", icon: "fas fa-clock" },
    { quote: "The future depends on what you do today.", author: "Mahatma Gandhi", icon: "fas fa-rocket" },
    { quote: "Dream is not that which you see while sleeping, it is something that does not let you sleep.", author: "A.P.J. Abdul Kalam", icon: "fas fa-cloud" },
    { quote: "Arise, awake, and stop not until the goal is reached.", author: "Swami Vivekananda", icon: "fas fa-flag-checkered" },
    { quote: "You have to dream before your dreams can come true.", author: "A.P.J. Abdul Kalam", icon: "fas fa-star" },
    { quote: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb", icon: "fas fa-tree" },
    { quote: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson", icon: "fas fa-stopwatch" },
    { quote: "The secret of getting ahead is getting started.", author: "Mark Twain", icon: "fas fa-play" },
    { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt", icon: "fas fa-fist-raised" },
    { quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill", icon: "fas fa-medal" }
  ],

  teamwork: [
    { quote: "Coming together is a beginning; keeping together is progress; working together is success.", author: "Henry Ford", icon: "fas fa-handshake" },
    { quote: "Alone we can do so little; together we can do so much.", author: "Helen Keller", icon: "fas fa-users" },
    { quote: "Teamwork makes the dream work.", author: "John Maxwell", icon: "fas fa-star" },
    { quote: "Great things in business are never done by one person. They're done by a team of people.", author: "Steve Jobs", icon: "fas fa-briefcase" },
    { quote: "The strength of the team is each individual member. The strength of each member is the team.", author: "Phil Jackson", icon: "fas fa-bolt" },
    { quote: "Unity is strength. When there is teamwork and collaboration, wonderful things can be achieved.", author: "Mattie Stepanek", icon: "fas fa-link" },
    { quote: "If everyone is moving forward together, then success takes care of itself.", author: "Henry Ford", icon: "fas fa-arrow-right" }
  ],

  success: [
    { quote: "Success is not the key to happiness. Happiness is the key to success.", author: "Albert Schweitzer", icon: "fas fa-smile" },
    { quote: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau", icon: "fas fa-chart-line" },
    { quote: "The way to get started is to quit talking and begin doing.", author: "Walt Disney", icon: "fas fa-film" },
    { quote: "Don't be afraid to give up the good to go for the great.", author: "John D. Rockefeller", icon: "fas fa-star" },
    { quote: "I find that the harder I work, the more luck I seem to have.", author: "Thomas Jefferson", icon: "fas fa-clover" },
    { quote: "Success is walking from failure to failure with no loss of enthusiasm.", author: "Winston Churchill", icon: "fas fa-walking" },
    { quote: "The only place where success comes before work is in the dictionary.", author: "Vidal Sassoon", icon: "fas fa-book" }
  ],

  innovation: [
    { quote: "Innovation is the ability to see change as an opportunity - not a threat.", author: "Steve Jobs", icon: "fas fa-lightbulb" },
    { quote: "The best way to predict the future is to invent it.", author: "Alan Kay", icon: "fas fa-crystal-ball" },
    { quote: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs", icon: "fas fa-rocket" },
    { quote: "The only way to discover the limits of the possible is to go beyond them into the impossible.", author: "Arthur C. Clarke", icon: "fas fa-space-shuttle" },
    { quote: "Creativity is intelligence having fun.", author: "Albert Einstein", icon: "fas fa-palette" },
    { quote: "Every once in a while, a new technology, an old problem, and a big idea turn into an innovation.", author: "Dean Kamen", icon: "fas fa-cog" }
  ],

  productivity: [
    { quote: "Focus on being productive instead of busy.", author: "Tim Ferriss", icon: "fas fa-bullseye" },
    { quote: "The key is not to prioritize what's on your schedule, but to schedule your priorities.", author: "Stephen Covey", icon: "fas fa-calendar-alt" },
    { quote: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar", icon: "fas fa-running" },
    { quote: "Amateurs sit and wait for inspiration, the rest of us just get up and go to work.", author: "Stephen King", icon: "fas fa-pen" },
    { quote: "The difference between ordinary and extraordinary is that little extra.", author: "Jimmy Johnson", icon: "fas fa-star" },
    { quote: "Quality means doing it right when no one is looking.", author: "Henry Ford", icon: "fas fa-check-circle" },
    { quote: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius", icon: "fas fa-forward" }
  ],

  balance: [
    { quote: "Balance is not something you find, it's something you create.", author: "Jana Kingsford", icon: "fas fa-balance-scale" },
    { quote: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn", icon: "fas fa-heart" },
    { quote: "Almost everything will work again if you unplug it for a few minutes, including you.", author: "Anne Lamott", icon: "fas fa-plug" },
    { quote: "Rest when you're weary. Refresh and renew yourself, your body, your mind, your spirit.", author: "Ralph Marston", icon: "fas fa-spa" },
    { quote: "You can't pour from an empty cup. Take care of yourself first.", author: "Self-Care Principle", icon: "fas fa-coffee" },
    { quote: "Happiness is not a matter of intensity but of balance, order, rhythm and harmony.", author: "Thomas Merton", icon: "fas fa-music" }
  ],

  indian_leaders: [
    { quote: "All of us do not have equal talent. But, all of us have an equal opportunity to develop our talents.", author: "A.P.J. Abdul Kalam", icon: "fas fa-flag" },
    { quote: "In a gentle way, you can shake the world.", author: "Mahatma Gandhi", icon: "fas fa-dove" },
    { quote: "Take up one idea. Make that one idea your life.", author: "Swami Vivekananda", icon: "fas fa-bullseye" },
    { quote: "The best way to find yourself is to lose yourself in the service of others.", author: "Mahatma Gandhi", icon: "fas fa-hands-helping" },
    { quote: "Stand up, be bold, be strong. Take the whole responsibility on your own shoulders.", author: "Swami Vivekananda", icon: "fas fa-fist-raised" },
    { quote: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi", icon: "fas fa-book-reader" },
    { quote: "You cannot believe in God until you believe in yourself.", author: "Swami Vivekananda", icon: "fas fa-praying-hands" },
    { quote: "Don't take rest after your first victory because if you fail in second, more lips are waiting to say that your first victory was just luck.", author: "A.P.J. Abdul Kalam", icon: "fas fa-trophy" },
    { quote: "Take risks in your life. If you win, you can lead. If you lose, you can guide.", author: "Swami Vivekananda", icon: "fas fa-dice" },
    { quote: "None can destroy iron, but its own rust can. Likewise, none can destroy a person, but their own mindset can.", author: "Ratan Tata", icon: "fas fa-shield-alt" },
    { quote: "I don't believe in taking right decisions. I take decisions and then make them right.", author: "Ratan Tata", icon: "fas fa-check-circle" },
    { quote: "If you want to walk fast, walk alone. But if you want to walk far, walk together.", author: "Ratan Tata", icon: "fas fa-shoe-prints" },
    { quote: "The day you stop learning is the day you stop growing.", author: "Narayana Murthy", icon: "fas fa-graduation-cap" },
    { quote: "Progress is often equal to the difference between mind and mindset.", author: "Narayana Murthy", icon: "fas fa-brain" }
  ],

  tech_leaders: [
    { quote: "Move fast and break things. Unless you are breaking stuff, you are not moving fast enough.", author: "Mark Zuckerberg", icon: "fas fa-bolt" },
    { quote: "Ideas are easy. Implementation is hard.", author: "Guy Kawasaki", icon: "fas fa-laptop-code" },
    { quote: "The biggest risk is not taking any risk.", author: "Mark Zuckerberg", icon: "fas fa-dice" },
    { quote: "Stay hungry, stay foolish.", author: "Steve Jobs", icon: "fas fa-apple-alt" },
    { quote: "Technology is best when it brings people together.", author: "Matt Mullenweg", icon: "fas fa-globe" },
    { quote: "Empathy is at the heart of design.", author: "Tim Brown", icon: "fas fa-heart" },
    { quote: "Intelligence is the ability to adapt to change.", author: "Stephen Hawking", icon: "fas fa-dna" },
    { quote: "We need to be the change we wish to see in the world.", author: "Sundar Pichai", icon: "fas fa-earth-americas" }
  ],

  women_leaders: [
    { quote: "The question isn't who's going to let me; it's who's going to stop me.", author: "Ayn Rand", icon: "fas fa-female" },
    { quote: "I never dreamed about success. I worked for it.", author: "Estée Lauder", icon: "fas fa-briefcase" },
    { quote: "Done is better than perfect.", author: "Sheryl Sandberg", icon: "fas fa-check-circle" },
    { quote: "The most effective way to do it, is to do it.", author: "Amelia Earhart", icon: "fas fa-plane" },
    { quote: "You can't be that kid standing at the top of the waterslide, overthinking it. You have to go down the chute.", author: "Tina Fey", icon: "fas fa-water" },
    { quote: "Think like a queen. A queen is not afraid to fail.", author: "Oprah Winfrey", icon: "fas fa-crown" },
    { quote: "I learned to always take on things I'd never done before. Growth and comfort do not coexist.", author: "Ginni Rometty", icon: "fas fa-seedling" },
    { quote: "The difference between successful people and others is how long they spend time feeling sorry for themselves.", author: "Barbara Corcoran", icon: "fas fa-clock" }
  ],

  monday: [
    { quote: "Your Monday morning thoughts set the tone for your whole week.", author: "Monday Motivation", icon: "fas fa-sun" },
    { quote: "New Monday, new week, new goals.", author: "Workplace Wisdom", icon: "fas fa-bullseye" },
    { quote: "Mondays are the start of the work week which offer new beginnings 52 times a year!", author: "David Dweck", icon: "fas fa-redo" },
    { quote: "Either you run the day or the day runs you.", author: "Jim Rohn", icon: "fas fa-running" },
    { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs", icon: "fas fa-briefcase" }
  ],

  friday: [
    { quote: "It's Friday! Time to go make stories for Monday.", author: "Friday Inspiration", icon: "fas fa-glass-cheers" },
    { quote: "Make each day of the week like Friday and your life will take on new enthusiasm.", author: "Byron Pulsifer", icon: "fas fa-smile-beam" },
    { quote: "Friday is a day to finish your goals for the week.", author: "Weekend Wisdom", icon: "fas fa-check-circle" },
    { quote: "Always finish strong. You never know who's watching.", author: "Workplace Wisdom", icon: "fas fa-fist-raised" }
  ]
};

// Smart quote selection based on role, day, and time
const getSmartQuote = (userRole, date = new Date()) => {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const hour = date.getHours();
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  
  let selectedCategory;
  
  // Day-based selection
  if (dayOfWeek === 1) { // Monday
    selectedCategory = quotes.monday;
  } else if (dayOfWeek === 5) { // Friday
    selectedCategory = quotes.friday;
  } 
  // Role-based selection
  else if (['MANAGER', 'HR', 'ADMIN'].includes(userRole)) {
    const categories = [quotes.leadership, quotes.teamwork, quotes.success];
    selectedCategory = categories[dayOfYear % categories.length];
  } 
  // Time-based selection
  else if (hour >= 6 && hour < 12) { // Morning
    const categories = [quotes.motivation, quotes.productivity, quotes.indian_leaders];
    selectedCategory = categories[dayOfYear % categories.length];
  } else if (hour >= 12 && hour < 17) { // Afternoon
    const categories = [quotes.innovation, quotes.tech_leaders, quotes.success];
    selectedCategory = categories[dayOfYear % categories.length];
  } else { // Evening
    const categories = [quotes.balance, quotes.women_leaders, quotes.teamwork];
    selectedCategory = categories[dayOfYear % categories.length];
  }
  
  // Fallback to all categories
  if (!selectedCategory) {
    const allCategories = Object.values(quotes).flat();
    const index = dayOfYear % allCategories.length;
    return allCategories[index];
  }
  
  const index = dayOfYear % selectedCategory.length;
  return selectedCategory[index];
};

module.exports = { getSmartQuote };
