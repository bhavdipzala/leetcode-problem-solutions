# LeetCode 9. Palindrome Number

- **LeetCode:** https://leetcode.com/problems/palindrome-number/
- **Difficulty:** ![Easy](https://img.shields.io/badge/-Easy-brightgreen)
- **Topics:** Math

## Approach

- return false if the number is negative.
- store the original number for comparison.
- reverse the number by extracting and appending its digits:
  - Initialise revNum = 0.
  - extract the last digit using x%10.
  - append it to the reversed number: revNum = revNum*10 + lastDig.
  - remove the extracted last digit using x = x/10.
  - Repeat while x != 0.
- Return true if the reversed number equals the original.

Overflow handling:<br>
reverse of a valid int can exceed Integer.MAX_VALUE, so revNum is a long.

Note: Negative numbers cannot be palindromes.<br>
Any number ending with 0 cannot be a palindrome, except 0 itself.

## Complexity

- **Time Complexity:** O(log |N|), each digit is processed once.
- **Space Complexity:** O(1), only a fixed number of variables.

## Solution

```java
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
```

[Raw .java file](./palindrome-number.java)
