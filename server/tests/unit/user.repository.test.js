'use strict';

const userRepository = require('../../src/modules/users/repositories/User.repository');
const { UserRepository } = require('../../src/modules/users/repositories');
const { User } = require('../../src/modules/users/models');

describe('User Repository (Sprint 2.2.4)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should export singleton instance and UserRepository class', () => {
    expect(userRepository).toBeDefined();
    expect(UserRepository).toBeDefined();
    expect(userRepository).toBeInstanceOf(UserRepository);
  });

  describe('findById', () => {
    it('should call User.findById and return user document', async () => {
      const mockUser = { _id: '507f1f77bcf86cd799439011', name: 'Jane Doe' };
      jest.spyOn(User, 'findById').mockResolvedValue(mockUser);

      const result = await userRepository.findById('507f1f77bcf86cd799439011');
      expect(User.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(result).toEqual(mockUser);
    });

    it('should return null when user is not found without throwing', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(null);

      const result = await userRepository.findById('507f1f77bcf86cd799439099');
      expect(result).toBeNull();
    });
  });

  describe('findByEmail & findByEmailWithPasswordHash', () => {
    it('should normalize email to lowercase and trim in findByEmail', async () => {
      const mockUser = { _id: '123', email: 'jane.doe@university.edu' };
      jest.spyOn(User, 'findOne').mockResolvedValue(mockUser);

      const result = await userRepository.findByEmail(
        '  Jane.Doe@University.EDU  '
      );
      expect(User.findOne).toHaveBeenCalledWith({
        email: 'jane.doe@university.edu',
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null for empty or invalid email input', async () => {
      const resultNull = await userRepository.findByEmail(null);
      const resultEmpty = await userRepository.findByEmail('');
      expect(resultNull).toBeNull();
      expect(resultEmpty).toBeNull();
    });

    it('should call select("+passwordHash") in findByEmailWithPasswordHash', async () => {
      const mockSelect = jest.fn().mockResolvedValue({
        _id: '123',
        email: 'jane@test.com',
        passwordHash: 'hash',
      });
      jest.spyOn(User, 'findOne').mockReturnValue({ select: mockSelect });

      const result =
        await userRepository.findByEmailWithPasswordHash('Jane@Test.COM');
      expect(User.findOne).toHaveBeenCalledWith({ email: 'jane@test.com' });
      expect(mockSelect).toHaveBeenCalledWith('+passwordHash');
      expect(result).toEqual({
        _id: '123',
        email: 'jane@test.com',
        passwordHash: 'hash',
      });
    });
  });

  describe('findByPhone', () => {
    it('should trim phone and find user', async () => {
      const mockUser = { _id: '123', phone: '+1234567890' };
      jest.spyOn(User, 'findOne').mockResolvedValue(mockUser);

      const result = await userRepository.findByPhone('  +1234567890  ');
      expect(User.findOne).toHaveBeenCalledWith({ phone: '+1234567890' });
      expect(result).toEqual(mockUser);
    });

    it('should return null for empty or invalid phone input', async () => {
      const resultNull = await userRepository.findByPhone(null);
      const resultEmpty = await userRepository.findByPhone('');
      expect(resultNull).toBeNull();
      expect(resultEmpty).toBeNull();
    });
  });

  describe('existsByEmail & existsByPhone', () => {
    it('should return true if email exists', async () => {
      jest.spyOn(User, 'exists').mockResolvedValue({ _id: '123' });

      const exists = await userRepository.existsByEmail('jane@test.com');
      expect(User.exists).toHaveBeenCalledWith({ email: 'jane@test.com' });
      expect(exists).toBe(true);
    });

    it('should return false if email does not exist', async () => {
      jest.spyOn(User, 'exists').mockResolvedValue(null);

      const exists = await userRepository.existsByEmail('absent@test.com');
      expect(exists).toBe(false);
    });

    it('should return true if phone exists', async () => {
      jest.spyOn(User, 'exists').mockResolvedValue({ _id: '123' });

      const exists = await userRepository.existsByPhone('+1234567890');
      expect(User.exists).toHaveBeenCalledWith({ phone: '+1234567890' });
      expect(exists).toBe(true);
    });

    it('should return false if phone does not exist', async () => {
      jest.spyOn(User, 'exists').mockResolvedValue(null);

      const exists = await userRepository.existsByPhone('+1234567890');
      expect(exists).toBe(false);
    });
  });

  describe('create', () => {
    it('should persist user via model instance save', async () => {
      const userData = {
        name: 'Jane Doe',
        email: 'jane@test.com',
        passwordHash: 'argon2_hashed_pw',
        role: 'STUDENT',
      };

      const mockSavedUser = { _id: '123', ...userData };
      jest.spyOn(User.prototype, 'save').mockResolvedValue(mockSavedUser);

      const result = await userRepository.create(userData);
      expect(User.prototype.save).toHaveBeenCalled();
      expect(result).toEqual(mockSavedUser);
    });
  });

  describe('updateById', () => {
    it('should call findByIdAndUpdate with runValidators and new: true', async () => {
      const updateData = { department: 'Physics', isEmailVerified: true };
      const mockUpdated = { _id: '123', ...updateData };
      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(mockUpdated);

      const result = await userRepository.updateById('123', updateData);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('123', updateData, {
        new: true,
        runValidators: true,
      });
      expect(result).toEqual(mockUpdated);
    });
  });
});
