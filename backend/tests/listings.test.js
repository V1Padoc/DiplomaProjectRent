// backend/tests/listings.test.js

const request = require('supertest');
const { server, sequelize } = require('../server');
const Listing = require('../models/Listing');
const User = require('../models/User');

// Групуємо тести для "Listings API"
describe('Listings API', () => {

  // Виносимо тестові дані вгору, щоб вони були доступні і в beforeAll, і в afterAll
  const testUsersData = [
    { name: 'Test User For Listing Test 1', email: 'listingtest1@test.com', password: 'password123', role: 'owner', phone_number: '111222333' },
    { name: 'Test User For Listing Test 2', email: 'listingtest2@test.com', password: 'password123', role: 'owner', phone_number: '444555666' },
  ];
  
  // Перед запуском всіх тестів створюємо необхідні дані
  beforeAll(async () => {
    // Створюємо тестових користувачів. ignoreDuplicates на випадок, якщо тест впав і не прибрав за собою
    await User.bulkCreate(testUsersData, { ignoreDuplicates: true });

    // Знаходимо ID щойно створених користувачів, щоб їх використати
    const user1 = await User.findOne({ where: { email: 'listingtest1@test.com' } });
    const user2 = await User.findOne({ where: { email: 'listingtest2@test.com' } });
    
    // Перевіряємо, чи користувачі були створені, перш ніж створювати оголошення
    if (!user1 || !user2) {
        throw new Error('Test users could not be created or found, aborting tests.');
    }

    // Створюємо тестові оголошення, прив'язані до цих користувачів
    await Listing.bulkCreate([
      { owner_id: user1.id, title: 'Test Listing 1', price: 100, location: 'Kyiv', type: 'daily-rental', status: 'active' },
      { owner_id: user1.id, title: 'Test Listing 2', price: 2500, location: 'Lviv', type: 'monthly-rental', status: 'active' },
      { owner_id: user2.id, title: 'Pending Listing', price: 150, location: 'Kyiv', type: 'daily-rental', status: 'pending' },
    ], { ignoreDuplicates: true });
  });

  // Після всіх тестів акуратно прибираємо за собою
  afterAll(async () => {
    // Використовуємо ту ж саму змінну testUsersData, яка тепер доступна
    const testUserEmails = testUsersData.map(u => u.email);
    const usersToDelete = await User.findAll({ where: { email: testUserEmails } });
    const userIdsToDelete = usersToDelete.map(u => u.id);

    // 1. Спочатку видаляємо "дочірні" записи (оголошення)
    if (userIdsToDelete.length > 0) {
      await Listing.destroy({ where: { owner_id: userIdsToDelete } });
    }
    
    // 2. Потім видаляємо "батьківські" записи (користувачів)
    if (testUserEmails.length > 0) {
      await User.destroy({ where: { email: testUserEmails } });
    }

    // 3. Закриваємо з'єднання
    await sequelize.close();
    server.close();
  });

  /**
   * Тест для Рисунку 2.13
   */
  describe('GET /api/listings', () => {
    it('should return 200 OK and a list of active listings', async () => {
      const response = await request(server).get('/api/listings');

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('listings');
      expect(Array.isArray(response.body.listings)).toBe(true);

      // Тепер перевірки мають бути "гнучкими", бо ми не знаємо, що ще є в базі
      
      // Перевіряємо, що серед повернутих оголошень є наші два тестові АКТИВНІ оголошення
      const receivedTitles = response.body.listings.map(l => l.title);
      expect(receivedTitles).toContain('Test Listing 1');
      expect(receivedTitles).toContain('Test Listing 2');

      // Перевіряємо, що серед повернутих оголошень НЕМАЄ нашого тестового НЕАКТИВНОГО оголошення
      expect(receivedTitles).not.toContain('Pending Listing');

      // Перевіримо структуру одного з наших тестових оголошень
      const testListing = response.body.listings.find(l => l.title === 'Test Listing 1');
      expect(testListing).toBeDefined(); // Переконуємось, що ми його знайшли
      expect(testListing).toHaveProperty('id');
      expect(testListing).toHaveProperty('price', '100.00'); // Ціна буде рядком
      expect(testListing).toHaveProperty('Owner');
    });
  });
});