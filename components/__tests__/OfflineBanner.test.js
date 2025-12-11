"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
Object.defineProperty(exports, "__esModule", { value: true });
var react_native_1 = require("@testing-library/react-native");
var AuthProvider_1 = require("@/context/AuthProvider");
var OfflineBanner_1 = require("../OfflineBanner");
jest.mock('@/context/AuthProvider', function () { return ({
    useAuth: jest.fn(),
}); });
jest.mock('@/hooks/useColorScheme', function () { return ({
    useColorScheme: jest.fn(function () { return 'light'; }),
}); });
var mockedUseAuth = AuthProvider_1.useAuth;
var createAuthMock = function (overrides) {
    if (overrides === void 0) { overrides = {}; }
    return (__assign({ user: null, pendingVerificationEmail: null, loading: false, isAdmin: false, healthOk: true, healthError: null, checkAuth: jest.fn(), signOut: jest.fn(), registerPushToken: jest.fn(), markOnboardingCompleteLocally: jest.fn() }, overrides));
};
describe('OfflineBanner', function () {
    afterEach(function () {
        jest.clearAllMocks();
    });
    it('renders nothing when API health is OK', function () {
        mockedUseAuth.mockReturnValue(createAuthMock());
        var toJSON = (0, react_native_1.render)(<OfflineBanner_1.OfflineBanner />).toJSON;
        expect(toJSON()).toBeNull();
    });
    it('shows error banner and retries authentication when pressed', function () { return __awaiter(void 0, void 0, void 0, function () {
        var checkAuth, getByText;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    checkAuth = jest.fn().mockResolvedValue(undefined);
                    mockedUseAuth.mockReturnValue(createAuthMock({
                        healthOk: false,
                        healthError: 'API unreachable',
                        checkAuth: checkAuth,
                    }));
                    getByText = (0, react_native_1.render)(<OfflineBanner_1.OfflineBanner />).getByText;
                    expect(getByText('API unreachable')).toBeTruthy();
                    react_native_1.fireEvent.press(getByText('Retry'));
                    return [4 /*yield*/, (0, react_native_1.waitFor)(function () {
                            expect(checkAuth).toHaveBeenCalledTimes(1);
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
