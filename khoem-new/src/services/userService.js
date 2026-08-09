const { ValidationError, NotFoundError } = require('./errors/CustomErrors');

// បញ្ជី Database ក្លែងក្លាយ
const mockUsers = [{ id: 1, name: 'Sokha', email: 'sokha@gmail.com' }];

function updateUserProfile(userId, data) {
    // ១. Validation Error
    if (!data || !data.email) {
        throw new ValidationError('Email មិនអាចទទេបានទេ');
    }

    // ២. Not Found Error
    const user = mockUsers.find(u => u.id === userId);
    if (!user) {
        throw new NotFoundError('អ្នកប្រើប្រាស់');
    }

    user.email = data.email;
    return { success: true, user };
}

module.exports = { updateUserProfile };
