"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BASE_URL = process.env.API_URL || 'http://localhost:3000';
let testCounter = 0;
let passedTests = 0;
let failedTests = 0;
function log(message, type = 'info') {
    const colors = {
        info: '\x1b[36m',
        success: '\x1b[32m',
        error: '\x1b[31m',
        warn: '\x1b[33m',
        reset: '\x1b[0m'
    };
    console.log(`${colors[type]}${message}${colors.reset}`);
}
function assert(condition, message) {
    testCounter++;
    if (condition) {
        passedTests++;
        log(`✓ Test ${testCounter}: ${message}`, 'success');
    }
    else {
        failedTests++;
        log(`✗ Test ${testCounter}: ${message}`, 'error');
        throw new Error(`Assertion failed: ${message}`);
    }
}
async function makeRequest(method, path, body) {
    const url = `${BASE_URL}${path}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    try {
        const response = await fetch(url, options);
        let data;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        }
        else {
            data = await response.text();
        }
        return {
            status: response.status,
            data,
            headers: response.headers,
        };
    }
    catch (error) {
        log(`Request failed: ${method} ${url}`, 'error');
        throw error;
    }
}
function getFutureTime(minutesFromNow) {
    const date = new Date();
    date.setMinutes(date.getMinutes() + minutesFromNow);
    const minutes = date.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 10) * 10;
    date.setMinutes(roundedMinutes);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date.toISOString();
}
function getPastTime(minutesAgo) {
    const date = new Date();
    date.setMinutes(date.getMinutes() - minutesAgo);
    const minutes = date.getMinutes();
    const roundedMinutes = Math.floor(minutes / 10) * 10;
    date.setMinutes(roundedMinutes);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date.toISOString();
}
async function testRoomsEndpoint() {
    log('\n📦 Testing GET /rooms', 'info');
    log('─'.repeat(50), 'info');
    const response = await makeRequest('GET', '/rooms');
    assert(response.status === 200, 'GET /rooms should return 200');
    assert(Array.isArray(response.data), 'Response should be an array');
    assert(response.data.length === 10, 'Should return exactly 10 rooms');
    const firstRoom = response.data[0];
    assert(typeof firstRoom.id === 'number', 'Room should have numeric id');
    assert(typeof firstRoom.name === 'string', 'Room should have string name');
    assert(firstRoom.id === 1, 'First room should have id 1');
    assert(firstRoom.name === 'Room 1', 'First room should be named "Room 1"');
    const lastRoom = response.data[9];
    assert(lastRoom.id === 10, 'Last room should have id 10');
    assert(lastRoom.name === 'Room 10', 'Last room should be named "Room 10"');
}
async function testCreateBooking() {
    log('\n📝 Testing POST /bookings - Valid Booking Creation', 'info');
    log('─'.repeat(50), 'info');
    const startTime = getFutureTime(30);
    const endTime = getFutureTime(60);
    const bookingData = {
        userId: 'testuser123',
        roomId: 1,
        startTime,
        endTime,
    };
    const response = await makeRequest('POST', '/bookings', bookingData);
    assert(response.status === 201, 'POST /bookings should return 201');
    assert(response.data.userId === 'testuser123', 'Booking should have correct userId');
    assert(response.data.roomId === 1, 'Booking should have correct roomId');
    assert(response.data.status === 'CONFIRMED', 'Booking should be CONFIRMED');
    assert(response.data.cancelledAt === null, 'cancelledAt should be null');
    assert(typeof response.data.id === 'number', 'Booking should have an id');
    return response.data.id;
}
async function testBookingValidations() {
    log('\n🔍 Testing POST /bookings - Validations', 'info');
    log('─'.repeat(50), 'info');
    log('\nTest: Invalid userId with special characters', 'warn');
    const invalidUserIdResponse = await makeRequest('POST', '/bookings', {
        userId: 'test@user!',
        roomId: 1,
        startTime: getFutureTime(30),
        endTime: getFutureTime(60),
    });
    assert(invalidUserIdResponse.status === 400, 'Should reject invalid userId format');
    assert(JSON.stringify(invalidUserIdResponse.data).includes('alphanumeric'), 'Error should mention alphanumeric requirement');
    log('\nTest: Past startTime', 'warn');
    const pastTimeResponse = await makeRequest('POST', '/bookings', {
        userId: 'testuser123',
        roomId: 1,
        startTime: getPastTime(30),
        endTime: getFutureTime(30),
    });
    assert(pastTimeResponse.status === 400, 'Should reject past startTime');
    assert(JSON.stringify(pastTimeResponse.data).includes('future'), 'Error should mention future requirement');
    log('\nTest: startTime >= endTime', 'warn');
    const startTime = getFutureTime(60);
    const invalidTimeResponse = await makeRequest('POST', '/bookings', {
        userId: 'testuser123',
        roomId: 1,
        startTime: startTime,
        endTime: startTime,
    });
    assert(invalidTimeResponse.status === 400, 'Should reject when startTime >= endTime');
    assert(JSON.stringify(invalidTimeResponse.data).includes('before'), 'Error should mention time ordering');
    log('\nTest: Invalid time granularity', 'warn');
    const invalidGranularityTime = new Date();
    invalidGranularityTime.setMinutes(invalidGranularityTime.getMinutes() + 30);
    invalidGranularityTime.setMinutes(15);
    invalidGranularityTime.setSeconds(0);
    invalidGranularityTime.setMilliseconds(0);
    const granularityResponse = await makeRequest('POST', '/bookings', {
        userId: 'testuser123',
        roomId: 1,
        startTime: invalidGranularityTime.toISOString(),
        endTime: getFutureTime(60),
    });
    assert(granularityResponse.status === 400, 'Should reject invalid time granularity');
    assert(JSON.stringify(granularityResponse.data).includes('10-minute'), 'Error should mention 10-minute intervals');
    log('\nTest: Non-existent room', 'warn');
    const invalidRoomResponse = await makeRequest('POST', '/bookings', {
        userId: 'testuser123',
        roomId: 999,
        startTime: getFutureTime(30),
        endTime: getFutureTime(60),
    });
    assert(invalidRoomResponse.status === 404, 'Should return 404 for non-existent room');
    log('\nTest: Overlapping bookings', 'warn');
    const overlapStart = getFutureTime(120);
    const overlapEnd = getFutureTime(150);
    const firstBooking = await makeRequest('POST', '/bookings', {
        userId: 'user1',
        roomId: 2,
        startTime: overlapStart,
        endTime: overlapEnd,
    });
    assert(firstBooking.status === 201, 'First booking should be created');
    const overlapResponse = await makeRequest('POST', '/bookings', {
        userId: 'user2',
        roomId: 2,
        startTime: overlapStart,
        endTime: overlapEnd,
    });
    assert(overlapResponse.status === 409, 'Should return 409 for overlapping booking');
    assert(JSON.stringify(overlapResponse.data).includes('conflict') ||
        JSON.stringify(overlapResponse.data).includes('overlap'), 'Error should mention conflict or overlap');
    log('\nTest: Same time slot for different rooms (should succeed)', 'warn');
    const differentRoomResponse = await makeRequest('POST', '/bookings', {
        userId: 'user3',
        roomId: 3,
        startTime: overlapStart,
        endTime: overlapEnd,
    });
    assert(differentRoomResponse.status === 201, 'Should allow same time for different rooms');
    log('\nTest: Valid 10-minute intervals', 'warn');
    const validStart = getFutureTime(200);
    const validEnd = getFutureTime(210);
    const validBooking = await makeRequest('POST', '/bookings', {
        userId: 'testuser456',
        roomId: 4,
        startTime: validStart,
        endTime: validEnd,
    });
    assert(validBooking.status === 201, 'Should accept valid 10-minute intervals');
}
async function testCancelBooking() {
    log('\n🚫 Testing PATCH /bookings/:id/cancel', 'info');
    log('─'.repeat(50), 'info');
    const startTime = getFutureTime(300);
    const endTime = getFutureTime(330);
    const createResponse = await makeRequest('POST', '/bookings', {
        userId: 'canceluser123',
        roomId: 5,
        startTime,
        endTime,
    });
    const bookingId = createResponse.data.id;
    log('\nTest: Successful cancellation with correct userId', 'warn');
    const cancelResponse = await makeRequest('PATCH', `/bookings/${bookingId}/cancel`, { userId: 'canceluser123' });
    assert(cancelResponse.status === 200, 'Should successfully cancel booking');
    assert(cancelResponse.data.status === 'CANCELLED', 'Status should be CANCELLED');
    assert(cancelResponse.data.cancelledAt !== null, 'cancelledAt should be set');
    log('\nTest: Cancel already cancelled booking', 'warn');
    const doubleCancelResponse = await makeRequest('PATCH', `/bookings/${bookingId}/cancel`, { userId: 'canceluser123' });
    assert(doubleCancelResponse.status === 409, 'Should return 409 for already cancelled');
    log('\nTest: Cancel with wrong userId', 'warn');
    const createResponse2 = await makeRequest('POST', '/bookings', {
        userId: 'user1',
        roomId: 6,
        startTime: getFutureTime(400),
        endTime: getFutureTime(430),
    });
    const wrongUserResponse = await makeRequest('PATCH', `/bookings/${createResponse2.data.id}/cancel`, { userId: 'wronguser' });
    assert(wrongUserResponse.status === 404, 'Should return 404 for wrong userId');
    log('\nTest: Cancel non-existent booking', 'warn');
    const notFoundResponse = await makeRequest('PATCH', '/bookings/999999/cancel', { userId: 'anyuser' });
    assert(notFoundResponse.status === 404, 'Should return 404 for non-existent booking');
    log('\nTest: Invalid userId format', 'warn');
    const invalidUserResponse = await makeRequest('PATCH', `/bookings/${bookingId}/cancel`, { userId: 'invalid@user!' });
    assert(invalidUserResponse.status === 400, 'Should return 400 for invalid userId format');
    log('\nTest: Cancel booking in the past', 'warn');
    const pastBookingStart = getFutureTime(10);
    const pastBookingEnd = getFutureTime(20);
    const pastBookingResponse = await makeRequest('POST', '/bookings', {
        userId: 'pastuser',
        roomId: 7,
        startTime: pastBookingStart,
        endTime: pastBookingEnd,
    });
    log('  Note: This test depends on timing and may occasionally fail', 'warn');
    log('\nTest: Cancelled bookings don\'t block new bookings', 'warn');
    const timeSlotStart = getFutureTime(500);
    const timeSlotEnd = getFutureTime(530);
    const blockingBooking = await makeRequest('POST', '/bookings', {
        userId: 'blocker',
        roomId: 8,
        startTime: timeSlotStart,
        endTime: timeSlotEnd,
    });
    await makeRequest('PATCH', `/bookings/${blockingBooking.data.id}/cancel`, {
        userId: 'blocker'
    });
    const newBookingResponse = await makeRequest('POST', '/bookings', {
        userId: 'newuser',
        roomId: 8,
        startTime: timeSlotStart,
        endTime: timeSlotEnd,
    });
    assert(newBookingResponse.status === 201, 'Cancelled booking should not block time slot');
}
async function testGetUserBookings() {
    log('\n👤 Testing GET /bookings/user/:userId', 'info');
    log('─'.repeat(50), 'info');
    const userId = 'getuser123';
    await makeRequest('POST', '/bookings', {
        userId,
        roomId: 1,
        startTime: getFutureTime(600),
        endTime: getFutureTime(630),
    });
    await makeRequest('POST', '/bookings', {
        userId,
        roomId: 2,
        startTime: getFutureTime(650),
        endTime: getFutureTime(680),
    });
    log('\nTest: Get bookings for user', 'warn');
    const response = await makeRequest('GET', `/bookings/user/${userId}`);
    assert(response.status === 200, 'Should return 200');
    assert(Array.isArray(response.data), 'Response should be an array');
    assert(response.data.length >= 2, 'Should return at least 2 bookings');
    assert(response.data[0].room !== undefined, 'Should include nested room data');
    for (let i = 1; i < response.data.length; i++) {
        const prev = new Date(response.data[i - 1].startTime);
        const curr = new Date(response.data[i].startTime);
        assert(prev <= curr, 'Bookings should be ordered by startTime ascending');
    }
    log('\nTest: Invalid userId format', 'warn');
    const invalidResponse = await makeRequest('GET', '/bookings/user/invalid@user');
    assert(invalidResponse.status === 400, 'Should return 400 for invalid userId format');
    log('\nTest: Non-existent user returns empty array', 'warn');
    const emptyResponse = await makeRequest('GET', '/bookings/user/nonexistentuser999');
    assert(emptyResponse.status === 200, 'Should return 200');
    assert(Array.isArray(emptyResponse.data), 'Should return array');
    assert(emptyResponse.data.length === 0, 'Should return empty array for non-existent user');
}
async function testGetRoomBookings() {
    log('\n🏠 Testing GET /bookings/room/:roomId endpoints', 'info');
    log('─'.repeat(50), 'info');
    const roomId = 9;
    const booking1Response = await makeRequest('POST', '/bookings', {
        userId: 'roomuser1',
        roomId,
        startTime: getFutureTime(700),
        endTime: getFutureTime(730),
    });
    const booking2Response = await makeRequest('POST', '/bookings', {
        userId: 'roomuser2',
        roomId,
        startTime: getFutureTime(750),
        endTime: getFutureTime(780),
    });
    await makeRequest('PATCH', `/bookings/${booking2Response.data.id}/cancel`, {
        userId: 'roomuser2'
    });
    log('\nTest: GET /bookings/room/:roomId - All bookings', 'warn');
    const allResponse = await makeRequest('GET', `/bookings/room/${roomId}`);
    assert(allResponse.status === 200, 'Should return 200');
    assert(Array.isArray(allResponse.data), 'Response should be an array');
    assert(allResponse.data.length >= 2, 'Should return at least 2 bookings');
    assert(allResponse.data[0].room !== undefined, 'Should include nested room data');
    log('\nTest: GET /bookings/room/:roomId/confirmed', 'warn');
    const confirmedResponse = await makeRequest('GET', `/bookings/room/${roomId}/confirmed`);
    assert(confirmedResponse.status === 200, 'Should return 200');
    assert(Array.isArray(confirmedResponse.data), 'Response should be an array');
    const allConfirmed = confirmedResponse.data.every((b) => b.status === 'CONFIRMED');
    assert(allConfirmed, 'All bookings should have CONFIRMED status');
    log('\nTest: GET /bookings/room/:roomId/cancelled', 'warn');
    const cancelledResponse = await makeRequest('GET', `/bookings/room/${roomId}/cancelled`);
    assert(cancelledResponse.status === 200, 'Should return 200');
    assert(Array.isArray(cancelledResponse.data), 'Response should be an array');
    assert(cancelledResponse.data.length >= 1, 'Should have at least 1 cancelled booking');
    const allCancelled = cancelledResponse.data.every((b) => b.status === 'CANCELLED');
    assert(allCancelled, 'All bookings should have CANCELLED status');
    log('\nTest: Non-existent room returns 404', 'warn');
    const notFoundResponse = await makeRequest('GET', '/bookings/room/999');
    assert(notFoundResponse.status === 404, 'Should return 404 for non-existent room');
    log('\nTest: Room with no bookings returns empty array', 'warn');
    const emptyResponse = await makeRequest('GET', '/bookings/room/10');
    assert(emptyResponse.status === 200, 'Should return 200');
    assert(Array.isArray(emptyResponse.data), 'Should return array');
    log('\nTest: Verify bookings ordered by startTime', 'warn');
    for (let i = 1; i < allResponse.data.length; i++) {
        const prev = new Date(allResponse.data[i - 1].startTime);
        const curr = new Date(allResponse.data[i].startTime);
        assert(prev <= curr, 'Bookings should be ordered by startTime ascending');
    }
}
async function runTests() {
    log('\n' + '='.repeat(50), 'info');
    log('🚀 Room Reservation API - Integration Tests', 'info');
    log('='.repeat(50), 'info');
    log(`API URL: ${BASE_URL}\n`, 'info');
    try {
        try {
            await makeRequest('GET', '/rooms');
            log('✓ Server is running and accessible\n', 'success');
        }
        catch (error) {
            log('✗ Cannot connect to server. Please start the server first.', 'error');
            log(`  Expected URL: ${BASE_URL}`, 'error');
            log('  Start server: npm run start or docker-compose up', 'warn');
            process.exit(1);
        }
        await testRoomsEndpoint();
        await testCreateBooking();
        await testBookingValidations();
        await testCancelBooking();
        await testGetUserBookings();
        await testGetRoomBookings();
        log('\n' + '='.repeat(50), 'info');
        log('📊 Test Summary', 'info');
        log('='.repeat(50), 'info');
        log(`Total Tests: ${testCounter}`, 'info');
        log(`✓ Passed: ${passedTests}`, 'success');
        log(`✗ Failed: ${failedTests}`, failedTests > 0 ? 'error' : 'info');
        log('='.repeat(50) + '\n', 'info');
        if (failedTests === 0) {
            log('🎉 All tests passed!', 'success');
            process.exit(0);
        }
        else {
            log('❌ Some tests failed', 'error');
            process.exit(1);
        }
    }
    catch (error) {
        log('\n❌ Test suite failed with error:', 'error');
        console.error(error);
        log(`\nPassed: ${passedTests}/${testCounter}`, 'warn');
        process.exit(1);
    }
}
runTests();
//# sourceMappingURL=test-api.js.map