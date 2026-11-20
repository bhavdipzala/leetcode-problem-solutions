/**
Approach:
- return false if the number is negative.
- store the original number for comparison.
- reverse the number by extracting and appending its digits:
  - Initialise revNum = 0.
  - extract the last digit using x%10.
  - append it to the reversed number: revNum = revNum*10 + lastDig.
  - remove the extracted last digit using x = x/10.
  - Repeat while x != 0.
- Return true if the reversed number equals the original.

Overflow handling:
reverse of a valid int can exceed Integer.MAX_VALUE, so revNum is a long.

Note: Negative numbers cannot be palindromes.
Any number ending with 0 cannot be a palindrome, except 0 itself.

Time: O(log |N|), each digit is processed once.
Space: O(1), only a fixed number of variables.
*/


class Solution {
    public boolean isPalindrome(int x) {

        if (x < 0) return false;

        int givenNum = x;
        long revNum = 0;

        while (x != 0) {
            int lastDig = x%10;
            revNum = revNum*10 + lastDig;
            x = x/10;
        }

        return givenNum == revNum;

    }
}
