/*
The Licensed Work is (c) 2022 Sygma
SPDX-License-Identifier: LGPL-3.0-only
*/
import {decodeDataHash} from "../utils/helpers"

const DEFAULT_DECIMALS = 18

describe('helpers', () => {
  it("decoded datahash", () => {
    const data = "0x0000000000000000000000000000000000000000000000003782dace9d900000000000000000000000000000000000000000000000000000000000000000001442da3ba8c586f6fe9ef6ed1d09423eb73e4fe25b"
    expect(decodeDataHash(data, DEFAULT_DECIMALS)).toMatchObject({
      amount: "4000000000000000000",
      destinationRecipientAddress: "0x42da3ba8c586f6fe9ef6ed1d09423eb73e4fe25b"
    })
  })
})