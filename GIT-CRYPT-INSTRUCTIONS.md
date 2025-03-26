# Git-Crypt Instructions

This repository uses git-crypt to securely store sensitive information like API keys and credentials directly in the repository.

## For Repository Users

To access the encrypted files (like .env):

1. Install git-crypt:
   ```
   # MacOS
   brew install git-crypt
   
   # Ubuntu/Debian
   sudo apt-get install git-crypt
   
   # Windows (via Chocolatey)
   choco install git-crypt
   ```

2. Request the git-crypt key from the repository owner.

3. Once you have the key file, run:
   ```
   git-crypt unlock /path/to/git-crypt-key
   ```

4. The encrypted files will now be decrypted on your local machine.

## For Repository Owners

The git-crypt key has been generated and stored as `git-crypt-key` in the root directory (this file should NEVER be committed to the repository).

Keep this key secure and share it only with trusted team members via secure channels (not via email, chat, etc.).

To add another user with their GPG key (more secure than sharing the key file):

1. Get their GPG key ID
2. Add their key to the repo:
   ```
   git-crypt add-gpg-user USER_GPG_KEY_ID
   ```

## Files Encrypted

- `.env` file at the root of the project
- All files in the `secrets/` directory 