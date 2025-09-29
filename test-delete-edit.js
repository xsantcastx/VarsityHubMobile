// Quick test script to check if delete/edit functionality is working
const API_BASE = 'http://localhost:4000';

// Get an auth token (you'll need to replace this with actual user credentials)
async function testAuth() {
  try {
    // First let's try to get user info with the token we saw in logs
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNtZnF4MnRnNjAwMWY0Ymdkem1nbHdhZzAiLCJpYXQiOjE3NTg5MTExNDQsImV4cCI6MTc1OTUxNTk0NH0.-TSdGwbrYtCeCpeWG4yXXzEFrd5qSXX5eQQzT1PyFKo';
    
    const response = await fetch(`${API_BASE}/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const user = await response.json();
      console.log('User info:', user);
      return { token, userId: user.id };
    } else {
      console.log('Auth failed:', response.status, await response.text());
      return null;
    }
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

// Test fetching posts
async function testPosts(token) {
  try {
    const response = await fetch(`${API_BASE}/posts?limit=5`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Posts response:', JSON.stringify(data, null, 2));
      return data.items || [];
    } else {
      console.log('Failed to fetch posts:', response.status, await response.text());
      return [];
    }
  } catch (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
}

// Test creating a post
async function testCreatePost(token) {
  try {
    const response = await fetch(`${API_BASE}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: 'Test post for delete/edit functionality - ' + Date.now(),
        title: 'Test Post'
      })
    });
    
    if (response.ok) {
      const post = await response.json();
      console.log('Created post:', post);
      return post;
    } else {
      console.log('Failed to create post:', response.status, await response.text());
      return null;
    }
  } catch (error) {
    console.error('Error creating post:', error);
    return null;
  }
}

// Main test function
async function runTests() {
  console.log('Testing delete/edit functionality...\n');
  
  const authData = await testAuth();
  if (!authData) {
    console.log('Auth failed, cannot continue tests');
    return;
  }
  
  console.log('\n--- Testing post fetching ---');
  const posts = await testPosts(authData.token);
  
  console.log('\n--- Testing post creation ---');
  const newPost = await testCreatePost(authData.token);
  
  console.log('\nTest complete!');
}

runTests();