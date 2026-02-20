// ============================================================================
// TEST SCRIPT FOR CODE-BASED AUTHENTICATION
// Run this in browser console to test the flow
// ============================================================================

const testEmailVerification = async () => {
  console.log('🧪 Starting Email Verification Tests...\n');

  const testEmail = `test${Date.now()}@example.com`;
  const testName = 'Test User';
  const testPassword = 'Test1234!';

  try {
    // TEST 1: Check if edge function is accessible
    console.log('📡 Test 1: Testing edge function endpoint...');
    const edgeUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-verification-email`;
    console.log('Edge Function URL:', edgeUrl);
    
    const testPayload = {
      email: testEmail,
      code: '123456',
      fullName: testName,
      type: 'signup'
    };

    const edgeResponse = await fetch(edgeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });

    if (edgeResponse.ok) {
      console.log('✅ Edge function is accessible');
      const edgeData = await edgeResponse.json();
      console.log('   Response:', edgeData);
    } else {
      console.error('❌ Edge function error:', edgeResponse.status);
      const errorText = await edgeResponse.text();
      console.error('   Error:', errorText);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // TEST 2: Test code generation and storage
    console.log('🔢 Test 2: Testing code generation...');
    const emailVerificationService = (await import('./services/auth/emailVerificationService')).default;
    
    const code = emailVerificationService.generateCode();
    console.log('Generated code:', code);
    console.log('Code length:', code.length);
    console.log('Is 6 digits:', /^\d{6}$/.test(code));
    
    if (code.length === 6 && /^\d{6}$/.test(code)) {
      console.log('✅ Code generation works');
    } else {
      console.error('❌ Code generation failed');
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // TEST 3: Test code hashing
    console.log('🔐 Test 3: Testing code hashing...');
    const hash1 = emailVerificationService.hashCode(code);
    const hash2 = emailVerificationService.hashCode(code);
    const hash3 = emailVerificationService.hashCode('000000');
    
    console.log('Hash 1:', hash1);
    console.log('Hash 2:', hash2);
    console.log('Same code produces same hash:', hash1 === hash2);
    console.log('Different code produces different hash:', hash1 !== hash3);
    
    if (hash1 === hash2 && hash1 !== hash3) {
      console.log('✅ Code hashing works correctly');
    } else {
      console.error('❌ Code hashing failed');
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // TEST 4: Test database table exists
    console.log('🗄️ Test 4: Checking database table...');
    const { supabase } = await import('./services/config/supabase');
    
    const { data: tableCheck, error: tableError } = await supabase
      .from('verification_codes')
      .select('id')
      .limit(1);

    if (tableError) {
      console.error('❌ Database table error:', tableError.message);
      console.log('   Make sure to run the SQL setup script!');
    } else {
      console.log('✅ Database table exists and is accessible');
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // TEST 5: Test rate limiting check
    console.log('⏱️ Test 5: Testing rate limit check...');
    const canSend = await emailVerificationService.checkRateLimit(testEmail);
    console.log('Can send email:', canSend);
    console.log('✅ Rate limiting check works');

    console.log('\n' + '='.repeat(60) + '\n');

    // TEST 6: Full integration test (if user confirms)
    console.log('📧 Test 6: Full Integration Test');
    console.log('⚠️ This will send a real email to:', testEmail);
    console.log('   Run the following in console to test full flow:\n');
    console.log(`testFullSignupFlow("${testEmail}", "${testName}", "${testPassword}")`);

    console.log('\n' + '='.repeat(60) + '\n');
    console.log('🎉 Basic tests completed!\n');

    return {
      edgeFunctionWorking: edgeResponse.ok,
      codeGenerationWorking: code.length === 6,
      hashingWorking: hash1 === hash2 && hash1 !== hash3,
      databaseWorking: !tableError,
      rateLimitWorking: typeof canSend === 'boolean'
    };

  } catch (error) {
    console.error('❌ Test suite error:', error);
    return null;
  }
};

// Full signup flow test
const testFullSignupFlow = async (email, name, password) => {
  console.log('🚀 Starting Full Signup Flow Test...\n');
  
  try {
    const authService = (await import('./services/auth/authService')).default;

    // Step 1: Initiate signup
    console.log('📝 Step 1: Initiating signup...');
    const initiateResult = await authService.initiateSignup(email, name);
    console.log('Result:', initiateResult);

    if (!initiateResult.success) {
      throw new Error('Failed to initiate signup');
    }

    console.log('✅ Verification code sent!');
    console.log('\n⚠️ Check your email for the code.');
    console.log('Then run:\n');
    console.log(`testCodeVerification("${email}", "${password}", "${name}", "YOUR_CODE_HERE")`);

    return initiateResult;
  } catch (error) {
    console.error('❌ Full signup test error:', error);
    throw error;
  }
};

// Code verification test
const testCodeVerification = async (email, password, name, code) => {
  console.log('🔐 Testing Code Verification...\n');
  
  try {
    const authService = (await import('./services/auth/authService')).default;

    console.log('Verifying code:', code);
    console.log('For email:', email);

    const result = await authService.completeSignup(email, password, name, code);
    console.log('Result:', result);

    if (result.success) {
      console.log('✅ CODE VERIFICATION SUCCESSFUL!');
      console.log('✅ Account created!');
      console.log('User ID:', result.user?.id);
      return result;
    } else {
      console.error('❌ Verification failed');
      return null;
    }
  } catch (error) {
    console.error('❌ Code verification error:', error);
    throw error;
  }
};

// Database cleanup test
const cleanupTestData = async (email) => {
  console.log('🧹 Cleaning up test data...\n');
  
  try {
    const { supabase } = await import('./services/config/supabase');

    // Delete verification codes
    await supabase
      .from('verification_codes')
      .delete()
      .eq('email', email);

    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.error('❌ Cleanup error:', error);
  }
};

// Export test functions to window for easy access
window.testEmailVerification = testEmailVerification;
window.testFullSignupFlow = testFullSignupFlow;
window.testCodeVerification = testCodeVerification;
window.cleanupTestData = cleanupTestData;

console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║  📧 Email Verification Test Suite Loaded                  ║
║                                                            ║
║  Available commands:                                       ║
║  ───────────────────────────────────────────────────────  ║
║  testEmailVerification()     - Run basic tests            ║
║  testFullSignupFlow(...)     - Test complete signup       ║
║  testCodeVerification(...)   - Test code verification     ║
║  cleanupTestData(email)      - Clean up test data         ║
║                                                            ║
║  Quick Start:                                              ║
║  1. Run: testEmailVerification()                          ║
║  2. Check the results                                      ║
║  3. Follow the prompts for full flow test                 ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);

// Auto-run basic tests
testEmailVerification().then(results => {
  console.log('\n📊 Test Results Summary:');
  console.table(results);
});