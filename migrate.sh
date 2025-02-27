
#!/bin/bash
echo "Running database migrations..."
npx drizzle-kit push --verbose
echo "Migrations completed!"
