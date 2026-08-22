const userService = require('./userService');
const { ValidationError, NotFoundError } = require('../errors/CustomErrors');

describe('UserService', () => {
  describe('findUserById', () => {
    it('should throw ValidationError if userId is not provided', async () => {
      await expect(userService.findUserById()).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError if user is not found', async () => {
      await expect(userService.findUserById('123')).rejects.toThrow(NotFoundError);
    });
  });
});

