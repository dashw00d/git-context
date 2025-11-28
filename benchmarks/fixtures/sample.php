<?php
/**
 * Sample PHP file for hybrid augmentation testing
 * Tests doc comments + semantic symbols
 */

namespace App\Services;

/**
 * Process user data
 * @param array $input User input data
 * @return array Processed data
 */
function processData(array $input): array {
    return array_map('trim', $input);
}

/**
 * User service class
 */
class UserService {
    /**
     * Get user by ID
     * @param int $id User ID
     * @return array|null User data or null
     */
    public function getUser(int $id): ?array {
        // Implementation here
        return null;
    }

    /**
     * Create new user
     * @param array $data User data
     * @return int New user ID
     */
    public function createUser(array $data): int {
        // Implementation here
        return 0;
    }
}

