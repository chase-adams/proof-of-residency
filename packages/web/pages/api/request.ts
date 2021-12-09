import { NextApiRequest, NextApiResponse } from 'next';
import { ethers } from 'ethers';
import path from 'path';
import { promises as fs } from 'fs';

import { SubmitAddressResponse, SubmitAddressRequest } from '../../types/submit-address';
import { Mapping } from '../../types/mapping';
import { generatePublicPrivateKey } from '../../src/api/bip';
import { findMappingIndexForPoint } from '../../src/api/city';
import { validateSignature, commitAddress } from '../../src/api/ethers';

const handler = async (req: NextApiRequest, res: NextApiResponse<SubmitAddressResponse | null>) => {
  try {
    const method = req.method;
    const body: SubmitAddressRequest = req.body;

    if (method === 'POST') {
      if (!body.signature) {
        return res.status(500).end('Signature must be supplied');
      }

      const signatureAddress = await validateSignature(
        JSON.stringify(body.payload, null, 2),
        body.signature
      );

      if (signatureAddress !== body.payload.walletAddress) {
        return res.status(500).end('Signature address does not match input address.');
      }

      const signatureHash = ethers.utils.keccak256(body.signature);

      const keygen = await generatePublicPrivateKey(signatureHash);

      const city = findMappingIndexForPoint(body.latitude, body.longitude);

      if (city === -1) {
        return res.status(404).end('City does not exist for latitude and longitude.');
      }

      const commitment = await commitAddress(
        signatureAddress,
        city,
        keygen.privateKey.toString('hex')
      );

      const commitmentTransaction = await commitment.wait();

      // if there is no commitment event, return an error and do not send a letter
      if (!commitmentTransaction.events?.some((e) => e.event === 'Commitment')) {
        return res.status(400).end('The transaction could not be successfully submitted.');
      }

      console.log(`Mnemonic: ${keygen.mnemonic}`);

      // TODO add Lob sending

      const mappingFile = path.join(process.cwd(), 'sources/mappings.json');
      const mappings: Mapping[] = JSON.parse((await fs.readFile(mappingFile, 'utf8')).toString());

      return res.status(200).json({
        city: mappings?.[city]?.name ?? ''
      });
    }

    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  } catch (err) {
    console.error(err);
    return res.status(500).json(null);
  }
};

export default handler;