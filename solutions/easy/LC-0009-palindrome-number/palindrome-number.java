/**
Approach: this is the approah
Time: O(n)
Space: O(N)
 */



class Solution {
    public boolean isPalindrome(int x) {
        // Negative numbers are never palindromes
        // Numbers ending in 0 are not palindromes (except 0 itself)
        if (x < 0 || (x % 10 == 0 && x != 0)) {
            return false;
        }

        int reversedHalf = 0;

        while (x > reversedHalf) {
            reversedHalf = reversedHalf * 10 + x % 10;
            x /= 10;
        }

        // Even number of digits: x == reversedHalf
        // Odd number of digits: x == reversedHalf / 10
        return x == reversedHalf || x == reversedHalf / 10;
    }
}
