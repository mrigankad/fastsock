import asyncio
import httpx

BASE = 'http://localhost:8000/api/v1'

async def create_dummy_user():
    async with httpx.AsyncClient(base_url=BASE) as client:
        print("Creating dummy user 'Alice'...")
        r = await client.post('/auth/signup', json={
            'email': 'alice@example.com', 
            'password': 'password123', 
            'full_name': 'Alice Wonderland'
        })
        if r.status_code == 200:
            print("Successfully created user: Alice")
        elif r.status_code == 400 and "already exists" in r.text:
             print("User Alice already exists.")
        else:
            print(f"Failed to create user: {r.status_code} {r.text}")

        print("Creating dummy user 'Bob'...")
        r = await client.post('/auth/signup', json={
            'email': 'bob@example.com', 
            'password': 'password123', 
            'full_name': 'Bob Builder'
        })
        if r.status_code == 200:
            print("Successfully created user: Bob")
        elif r.status_code == 400:
            print("User Bob already exists or error.")

if __name__ == "__main__":
    asyncio.run(create_dummy_user())