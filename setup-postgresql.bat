# PostgreSQL Setup Script for Production
# Run this after installing PostgreSQL

# PostgreSQL Installation Commands (when ready):
# Windows: choco install postgresql
# Or download installer from: https://www.postgresql.org/download/windows/

echo "🗄️ PostgreSQL Setup Instructions:"
echo "1. Install PostgreSQL using one of the methods above"
echo "2. During installation, remember your postgres user password"
echo "3. After installation, run the database setup commands below"
echo ""
echo "📋 Database Setup Commands (run in psql or pgAdmin):"
echo "CREATE DATABASE chattingapp_new;"
echo "CREATE USER chatapp_user WITH PASSWORD 'your_secure_password';"
echo "GRANT ALL PRIVILEGES ON DATABASE chattingapp_new TO chatapp_user;"
echo ""
echo "🔧 Then update your .env file with the PostgreSQL connection string"
echo "DATABASE_URL=postgresql://chatapp_user:your_secure_password@localhost:5432/chattingapp_new"