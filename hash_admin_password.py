"""Create or rotate the ABYSS.IO administrator credential.

Two modes:

    python server/hash_admin_password.py --write-env
        Generates a fresh random username, a 40-character random password and
        an Argon2id hash, then writes ABYSS_ADMIN_USER and
        ABYSS_ADMIN_PASSWORD_HASH into server/.env. The plain password is
        printed once so it can be saved in a password manager.

    python server/hash_admin_password.py
        Asks for a password with getpass() and prints the hash line instead.

Only the hash is ever written to disk. The plain password is never stored,
logged or sent anywhere.
"""

import argparse
import getpass
import hashlib
import os
import secrets
import string
import sys

N, R, P, DKLEN = 16384, 8, 1, 64
ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
PASSWORD_MIN = 32
DEFAULT_LENGTH = 40
# No quotes, backslash, backtick, dollar, hash or whitespace: keeps copy and
# paste into shells, .env files and secret managers painless.
PASSWORD_SYMBOLS = '!@%^*-_+=?.:'


def try_argon2():
    try:
        from argon2 import PasswordHasher
    except ImportError:
        return None
    return PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4,
                          hash_len=32, salt_len=16)


def scrypt_hash(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode('utf-8'), salt=salt, n=N, r=R, p=P,
                            dklen=DKLEN, maxmem=64 * 1024 * 1024)
    return 'scrypt$%d$%d$%d$%s$%s' % (N, R, P, salt.hex(), digest.hex())


def make_hash(password, hasher):
    if hasher is not None:
        return 'argon2id', hasher.hash(password)
    return 'scrypt-fallback', scrypt_hash(password)


def make_username():
    alphabet = string.ascii_lowercase + string.digits
    return 'abyss_' + ''.join(secrets.choice(alphabet) for _ in range(10))


def make_password(length):
    length = max(PASSWORD_MIN, int(length))
    pools = (string.ascii_uppercase, string.ascii_lowercase,
             string.digits, PASSWORD_SYMBOLS)
    chars = [secrets.choice(pool) for pool in pools]
    every = string.ascii_letters + string.digits + PASSWORD_SYMBOLS
    chars += [secrets.choice(every) for _ in range(length - len(chars))]
    secrets.SystemRandom().shuffle(chars)
    return ''.join(chars)


def write_env(username, hash_value):
    lines = []
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, 'r', encoding='utf-8') as fh:
            lines = fh.read().splitlines()
    wanted = {
        'ABYSS_ADMIN_USER': username,
        'ABYSS_ADMIN_PASSWORD_HASH': hash_value
    }
    seen = set()
    out = []
    for line in lines:
        stripped = line.strip()
        key = stripped.split('=', 1)[0].strip() if '=' in stripped else ''
        if key in wanted:
            out.append('%s=%s' % (key, wanted[key]))
            seen.add(key)
        elif key == 'ABYSS_ADMIN_PASSWORD':
            # Drop the legacy plain-text variable: one credential, one source.
            continue
        else:
            out.append(line)
    if out and out[-1].strip():
        out.append('')
    for key, value in wanted.items():
        if key not in seen:
            out.append('%s=%s' % (key, value))
    out.append('')
    with open(ENV_PATH, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('\n'.join(out))
    try:
        os.chmod(ENV_PATH, 0o600)
    except OSError:
        pass


def main():
    parser = argparse.ArgumentParser(description='ABYSS.IO admin credential generator')
    parser.add_argument('--write-env', action='store_true',
                        help='write ABYSS_ADMIN_USER and ABYSS_ADMIN_PASSWORD_HASH to server/.env')
    parser.add_argument('--username', default='',
                        help='use this admin username instead of a generated one')
    parser.add_argument('--generate', action='store_true',
                        help='generate a random password instead of prompting')
    parser.add_argument('--length', type=int, default=DEFAULT_LENGTH,
                        help='generated password length (minimum %d)' % PASSWORD_MIN)
    args = parser.parse_args()

    hasher = try_argon2()
    if hasher is None:
        sys.stderr.write('argon2-cffi is not installed; falling back to scrypt.\n'
                         'Install it with: python -m pip install argon2-cffi\n\n')

    username = (args.username or '').strip() or make_username()

    if args.generate or args.write_env:
        password = make_password(args.length)
    else:
        password = getpass.getpass('Admin password (leave empty to generate): ')
        if not password:
            password = make_password(args.length)
        elif len(password) < PASSWORD_MIN:
            print('Use at least %d characters for an administrator password.' % PASSWORD_MIN)
            return 1
        else:
            confirm = getpass.getpass('Confirm password: ')
            if password != confirm:
                print('The two passwords do not match.')
                return 1

    kind, hash_value = make_hash(password, hasher)

    if args.write_env:
        write_env(username, hash_value)

    print('')
    print('  ABYSS.IO administrator credential')
    print('  ---------------------------------')
    print('  username:  %s' % username)
    print('  password:  %s' % password)
    print('  hashing:   %s' % kind)
    print('')
    print('  Save the password in a password manager now; it is shown once and')
    print('  is not written to disk. Only this hash is stored:')
    print('')
    print('  ABYSS_ADMIN_USER=%s' % username)
    print('  ABYSS_ADMIN_PASSWORD_HASH=%s' % hash_value)
    print('')
    if args.write_env:
        print('  Written to: %s' % ENV_PATH)
        print('  Restart the server to activate the new credential.')
    else:
        print('  Paste those two lines into server/.env or your host secrets.')
    print('')
    return 0


if __name__ == '__main__':
    sys.exit(main())
