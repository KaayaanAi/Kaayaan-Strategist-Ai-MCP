#!/bin/bash

# Security Setup Script for Kaayaan Strategist AI MCP Server
# Generates secure credentials and validates configuration

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENV_FILE=".env.production"
BACKUP_DIR="./backups/security"
LOG_FILE="./logs/security-setup.log"

# Create directories
mkdir -p "$(dirname "$LOG_FILE")" "$BACKUP_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

print_header() {
    echo -e "${BLUE}"
    echo "=================================================="
    echo "  Kaayaan Strategist AI MCP - Security Setup"
    echo "=================================================="
    echo -e "${NC}"
}

print_step() {
    echo -e "${YELLOW}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_step "Checking dependencies..."
    
    local deps=("openssl" "docker" "docker-compose")
    local missing=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing+=("$dep")
        fi
    done
    
    if [ ${#missing[@]} -gt 0 ]; then
        print_error "Missing dependencies: ${missing[*]}"
        echo "Please install the missing dependencies and run this script again."
        exit 1
    fi
    
    print_success "All dependencies found"
}

# Generate secure random passwords
generate_password() {
    local length=${1:-32}
    openssl rand -hex "$length"
}

# Generate API key
generate_api_key() {
    openssl rand -hex 32
}

# Generate bcrypt hash for basic auth
generate_bcrypt_hash() {
    local password="$1"
    # Using Python to generate bcrypt hash
    python3 -c "import bcrypt; print(bcrypt.hashpw(b'$password', bcrypt.gensalt()).decode())" 2>/dev/null || \
    echo "admin:\$(openssl passwd -apr1 $password)"
}

# Backup existing configuration
backup_existing_config() {
    print_step "Backing up existing configuration..."
    
    if [ -f "$ENV_FILE" ]; then
        local backup_file="$BACKUP_DIR/.env.production.backup.$(date +%Y%m%d-%H%M%S)"
        cp "$ENV_FILE" "$backup_file"
        print_success "Existing configuration backed up to: $backup_file"
    fi
}

# Generate secure credentials
generate_credentials() {
    print_step "Generating secure credentials..."
    
    # Generate passwords
    local mongo_password
    local redis_password
    local api_key
    local basic_auth_password
    
    mongo_password=$(generate_password 24)
    redis_password=$(generate_password 24)
    api_key=$(generate_api_key)
    basic_auth_password=$(generate_password 16)
    
    # Create environment file
    cat > "$ENV_FILE" << EOF
# PRODUCTION ENVIRONMENT CONFIGURATION
# Generated on: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# DO NOT COMMIT THIS FILE TO VERSION CONTROL

# ==================== SERVER CONFIGURATION ====================
HTTP_MODE=true
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
WEBSOCKET_PORT=3001

# ==================== DATABASE CONFIGURATION ====================
MONGODB_URI=mongodb://kaayaan_admin:${mongo_password}@mongo:27017/kaayaan_strategist?authSource=admin
REDIS_URL=redis://:${redis_password}@redis:6379/0

# ==================== SECURITY CONFIGURATION ====================
ENABLE_AUTH=true
API_KEY=${api_key}

# CORS Origins - UPDATE WITH YOUR ACTUAL DOMAINS
ALLOWED_ORIGINS=https://yourdomain.com,https://api.yourdomain.com

# Database Credentials
MONGO_ROOT_USERNAME=kaayaan_admin
MONGO_ROOT_PASSWORD=${mongo_password}
REDIS_PASSWORD=${redis_password}

# ==================== APPLICATION CONFIGURATION ====================
TIMEZONE=UTC
CACHE_TTL_MINUTES=15
LOG_LEVEL=info

# ==================== RATE LIMITING ====================
YAHOO_RATE_LIMIT=60
ALPHA_VANTAGE_RATE_LIMIT=5
COINGECKO_RATE_LIMIT=50

# ==================== EXTERNAL SERVICES ====================
# ALPHA_VANTAGE_API_KEY=your_api_key_here

# ==================== TRAEFIK CONFIGURATION ====================
ACME_EMAIL=admin@yourdomain.com
TRAEFIK_BASIC_AUTH=admin:$(generate_bcrypt_hash "$basic_auth_password" | cut -d':' -f2)

# ==================== DOCKER PORTS ====================
EXTERNAL_HTTP_PORT=3000
EXTERNAL_WS_PORT=3001

# ==================== BACKUP CREDENTIALS ====================
# Generated credentials for reference:
# Basic Auth Password: ${basic_auth_password}
# API Key: ${api_key}
# MongoDB Password: ${mongo_password}
# Redis Password: ${redis_password}
EOF

    chmod 600 "$ENV_FILE"
    print_success "Secure credentials generated and saved to $ENV_FILE"
    
    # Save credentials to secure backup file
    local cred_file="$BACKUP_DIR/credentials.$(date +%Y%m%d-%H%M%S).txt"
    cat > "$cred_file" << EOF
Kaayaan Strategist AI MCP Server - Production Credentials
Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

API Key: ${api_key}
MongoDB Admin Password: ${mongo_password}
Redis Password: ${redis_password}
Basic Auth Password: ${basic_auth_password}

IMPORTANT:
1. Store these credentials in a secure password manager
2. Update ALLOWED_ORIGINS in .env.production with your actual domains
3. Update ACME_EMAIL with your actual email address
4. Never commit the .env.production file to version control
EOF
    
    chmod 600 "$cred_file"
    print_success "Credentials backed up to: $cred_file"
}

# Validate configuration
validate_configuration() {
    print_step "Validating configuration..."
    
    local errors=()
    
    # Check if .env file exists
    if [ ! -f "$ENV_FILE" ]; then
        errors+=("Environment file $ENV_FILE not found")
    else
        # Source the environment file
        set -a
        source "$ENV_FILE"
        set +a
        
        # Validate required variables
        local required_vars=(
            "API_KEY"
            "MONGO_ROOT_PASSWORD" 
            "REDIS_PASSWORD"
            "MONGODB_URI"
            "REDIS_URL"
        )
        
        for var in "${required_vars[@]}"; do
            if [ -z "${!var:-}" ]; then
                errors+=("Required environment variable $var is not set")
            fi
        done
        
        # Validate API key format (64 hex characters)
        if [ -n "${API_KEY:-}" ] && ! [[ "$API_KEY" =~ ^[a-f0-9]{64}$ ]]; then
            errors+=("API_KEY must be 64 hexadecimal characters")
        fi
        
        # Check for default/weak passwords
        local weak_patterns=("password" "123456" "admin" "changeme" "default")
        for pattern in "${weak_patterns[@]}"; do
            if [[ "${MONGO_ROOT_PASSWORD:-}" == *"$pattern"* ]]; then
                errors+=("MongoDB password contains weak pattern: $pattern")
            fi
            if [[ "${REDIS_PASSWORD:-}" == *"$pattern"* ]]; then
                errors+=("Redis password contains weak pattern: $pattern")
            fi
        done
        
        # Validate CORS origins
        if [[ "${ALLOWED_ORIGINS:-}" == *"localhost"* ]] && [ "$NODE_ENV" == "production" ]; then
            errors+=("Production environment should not allow localhost origins")
        fi
    fi
    
    # Check Docker configuration
    if [ ! -f "docker-compose.production.yml" ]; then
        errors+=("Production Docker Compose file not found")
    fi
    
    # Check Dockerfile
    if [ ! -f "Dockerfile" ]; then
        errors+=("Dockerfile not found")
    fi
    
    if [ ${#errors[@]} -gt 0 ]; then
        print_error "Configuration validation failed:"
        for error in "${errors[@]}"; do
            echo "  - $error"
        done
        return 1
    else
        print_success "Configuration validation passed"
        return 0
    fi
}

# Test Docker configuration
test_docker_config() {
    print_step "Testing Docker configuration..."
    
    # Validate Docker Compose file
    if docker-compose -f docker-compose.production.yml config > /dev/null 2>&1; then
        print_success "Docker Compose configuration is valid"
    else
        print_error "Docker Compose configuration validation failed"
        return 1
    fi
    
    # Check if required images can be built/pulled
    print_step "Checking Docker images..."
    
    local images=("mongo:6.0-jammy" "redis:7-alpine" "traefik:v2.10")
    for image in "${images[@]}"; do
        if docker image inspect "$image" > /dev/null 2>&1; then
            print_success "Image $image is available"
        else
            print_warning "Image $image not found locally, will be pulled during deployment"
        fi
    done
}

# Security scan
run_security_scan() {
    print_step "Running security scan..."
    
    # Check file permissions
    if [ -f "$ENV_FILE" ]; then
        local perms
        perms=$(stat -c "%a" "$ENV_FILE" 2>/dev/null || stat -f "%A" "$ENV_FILE" 2>/dev/null || echo "000")
        if [ "$perms" != "600" ]; then
            print_warning "Environment file permissions should be 600 (currently $perms)"
        else
            print_success "Environment file permissions are secure"
        fi
    fi
    
    # Check for secrets in version control
    if command -v git &> /dev/null && git rev-parse --git-dir > /dev/null 2>&1; then
        local tracked_secrets
        tracked_secrets=$(git ls-files | grep -E '\.(env|key|pem|p12)$' || true)
        if [ -n "$tracked_secrets" ]; then
            print_warning "Potential secret files tracked in git:"
            echo "$tracked_secrets"
        else
            print_success "No obvious secret files tracked in git"
        fi
    fi
    
    # Check Docker security
    print_step "Checking Docker security settings..."
    
    if docker info | grep -q "Security Options.*apparmor\|Security Options.*seccomp"; then
        print_success "Docker security features are enabled"
    else
        print_warning "Docker security features may not be fully enabled"
    fi
}

# Generate deployment checklist
generate_deployment_checklist() {
    print_step "Generating deployment checklist..."
    
    local checklist_file="./DEPLOYMENT_CHECKLIST.md"
    
    cat > "$checklist_file" << 'EOF'
# Production Deployment Checklist

## Pre-Deployment Security Checklist

### Environment Configuration
- [ ] Update `ALLOWED_ORIGINS` with actual domain names
- [ ] Update `ACME_EMAIL` with your actual email address
- [ ] Verify all passwords are strong and unique
- [ ] Ensure `.env.production` is not committed to version control
- [ ] Confirm `NODE_ENV=production`

### Security Configuration
- [ ] API authentication is enabled (`ENABLE_AUTH=true`)
- [ ] Strong API key generated (64 hex characters)
- [ ] MongoDB authentication configured
- [ ] Redis password authentication enabled
- [ ] CORS configured for production domains only

### Infrastructure Security
- [ ] Reverse proxy (Traefik) configured with HTTPS
- [ ] SSL/TLS certificates configured
- [ ] Database ports not exposed externally
- [ ] Security headers configured
- [ ] Rate limiting enabled

### Container Security
- [ ] Containers running as non-root users
- [ ] Read-only root filesystems where possible
- [ ] Security options configured (`no-new-privileges`, `cap-drop`)
- [ ] Resource limits set
- [ ] Health checks configured

## Deployment Steps

1. **Prepare Environment**
   ```bash
   # Copy environment file
   cp .env.production.secure .env.production
   
   # Update domain-specific variables
   nano .env.production
   ```

2. **Deploy Services**
   ```bash
   # Deploy in production mode
   docker-compose -f docker-compose.production.yml up -d
   ```

3. **Verify Deployment**
   ```bash
   # Check service health
   docker-compose -f docker-compose.production.yml ps
   
   # Test health endpoint
   curl -k https://yourdomain.com/health
   
   # Check logs for errors
   docker-compose -f docker-compose.production.yml logs --tail=100
   ```

4. **Security Validation**
   ```bash
   # Run security scan
   docker-compose -f docker-compose.production.yml --profile security-scan up security-scanner
   
   # Verify TLS configuration
   openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
   ```

## Post-Deployment Security

### Monitoring Setup
- [ ] Configure security monitoring alerts
- [ ] Set up health check monitoring
- [ ] Configure log aggregation
- [ ] Set up backup monitoring

### Maintenance
- [ ] Schedule regular security updates
- [ ] Plan backup and recovery procedures
- [ ] Document incident response procedures
- [ ] Schedule security audits

### Access Control
- [ ] Limit SSH access to servers
- [ ] Configure firewall rules
- [ ] Set up VPN access if required
- [ ] Document admin access procedures

## Emergency Procedures

### Service Failure
1. Check service logs: `docker-compose logs [service_name]`
2. Restart failed service: `docker-compose restart [service_name]`
3. Check resource usage: `docker stats`

### Security Incident
1. Immediately revoke compromised API keys
2. Check security logs for indicators of compromise
3. Isolate affected services if necessary
4. Document and report the incident

### Data Recovery
1. Stop all services: `docker-compose down`
2. Restore from backup
3. Verify data integrity
4. Restart services and validate

## Compliance Notes

- Ensure GDPR compliance if handling EU user data
- Maintain audit logs for compliance requirements
- Regular security assessments recommended
- Keep dependency versions updated for security patches

---

Generated by: Kaayaan Strategist AI MCP Security Setup
Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

    print_success "Deployment checklist generated: $checklist_file"
}

# Main execution
main() {
    print_header
    log "Starting security setup process"
    
    # Check if running as root
    if [ "$EUID" -eq 0 ]; then
        print_warning "Running as root. Consider using a non-root user for better security."
    fi
    
    # Run all steps
    check_dependencies
    backup_existing_config
    generate_credentials
    
    if validate_configuration; then
        test_docker_config
        run_security_scan
        generate_deployment_checklist
        
        echo
        print_success "Security setup completed successfully!"
        echo
        echo "Next steps:"
        echo "1. Review and update domain-specific settings in $ENV_FILE"
        echo "2. Store generated credentials securely"
        echo "3. Follow the deployment checklist in DEPLOYMENT_CHECKLIST.md"
        echo "4. Deploy using: docker-compose -f docker-compose.production.yml up -d"
        echo
        print_warning "Important: Never commit $ENV_FILE to version control!"
        
    else
        print_error "Security setup failed. Please fix the configuration issues and run again."
        exit 1
    fi
    
    log "Security setup process completed"
}

# Run main function
main "$@"