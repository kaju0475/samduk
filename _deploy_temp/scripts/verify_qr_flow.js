"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv_1 = __importDefault(require("dotenv"));
var supabase_js_1 = require("@supabase/supabase-js");
var crypto_1 = require("../app/lib/crypto");
var path_1 = __importDefault(require("path"));
// Load .env.local
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env.local') });
var SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
var SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Missing Environment Variables!');
    process.exit(1);
}
var adminClient = (0, supabase_js_1.createClient)(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false }
});
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, user, error, targetPayload, encrypted, apiToken, response, result, cookies, e_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('🔍 Starting QR Login Verification...');
                    return [4 /*yield*/, adminClient
                            .from('users')
                            .select('id, username, name')
                            .limit(1)
                            .single()];
                case 1:
                    _a = _b.sent(), user = _a.data, error = _a.error;
                    if (error || !user) {
                        console.error('❌ Failed to fetch test user:', error);
                        process.exit(1);
                    }
                    console.log("\u2705 Found Test User: ".concat(user.name, " (").concat(user.username, ")"));
                    targetPayload = user.username;
                    console.log("\uD83D\uDD12 Encrypting payload: \"".concat(targetPayload, "\""));
                    encrypted = (0, crypto_1.encryptToken)(targetPayload);
                    apiToken = "ENC-".concat(encrypted);
                    console.log("\uD83D\uDCE8 Sending Token to API: ".concat(apiToken.substring(0, 20), "..."));
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 5, , 6]);
                    return [4 /*yield*/, fetch('http://localhost:3000/api/auth/qr-login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token: apiToken })
                        })];
                case 3:
                    response = _b.sent();
                    return [4 /*yield*/, response.json()];
                case 4:
                    result = _b.sent();
                    if (response.ok && result.success) {
                        console.log('🎉 Login Success!');
                        console.log('   User:', result.user.name);
                        // Check formatted details
                        if (result.user.username === user.username) {
                            console.log('   ✅ Username Match');
                        }
                        else {
                            console.error('   ❌ Username Mismatch');
                        }
                        cookies = response.headers.get('set-cookie');
                        if (cookies && cookies.includes('user=')) {
                            console.log('   ✅ Session Cookie Set');
                        }
                        else {
                            console.warn('   ⚠️ No Cookie Found in response headers (might be normal if fetch handles it differently, but usually safe to check)');
                        }
                    }
                    else {
                        console.error('❌ Login Failed:', result);
                    }
                    return [3 /*break*/, 6];
                case 5:
                    e_1 = _b.sent();
                    console.error('❌ Network/API Error:', e_1.message);
                    console.log('   (Ensure server is running at http://localhost:3000)');
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
main();
