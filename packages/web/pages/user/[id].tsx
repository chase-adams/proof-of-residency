import {
  Box,
  Divider,
  Flex,
  Grid,
  Heading,
  SimpleGrid,
  Tag,
  Text,
  Tooltip
} from '@chakra-ui/react';
import { GetStaticPaths, GetStaticPropsContext } from 'next';
import { NextSeo } from 'next-seo';
import Image from 'next/image';
import Link from 'next/link';
import { ParsedUrlQuery } from 'querystring';
import React from 'react';
import { getAllTokenOwners, getTokensForOwner } from 'src/api/subgraph';
import { getChainForChainId } from 'src/contracts';
import Header from 'src/web/components/Header';
import { getCountryAndTokenNumber } from 'src/web/token';
import { MetadataResponse } from 'types';
import { chainId } from 'wagmi';
import Footer from '../../src/web/components/Footer';

type UserDetailsProps = {
  tokens: {
    tokenId: string;
    tokenNumber: string;
    link: string;
    image: string;

    chain: string;
  }[];
  ownerId: string;
};

interface Params extends ParsedUrlQuery {
  id: string;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const allTokensForOwner = await getAllTokenOwners();

  const allOwners = allTokensForOwner.map((e) => e.id).filter((v, i, a) => a.indexOf(v) === i);

  return {
    paths: allOwners.map((owner) => {
      const params: Params = { id: owner };

      return { params };
    }),

    fallback: false
  };
};

export const getStaticProps = async ({ params }: GetStaticPropsContext<Params>) => {
  const owner = params?.id ?? '';

  if (!owner) {
    console.error('No id passed');
    return { notFound: true };
  }

  try {
    const allTokens = await getTokensForOwner(owner);

    console.log({ allTokens });

    if (!allTokens) {
      console.error('No tokens found');
      return { notFound: true };
    }

    const tokensMapped = [
      ...(allTokens.l1?.map((t) => ({
        ...t,
        chain: chainId.mainnet
      })) ?? []),
      ...(allTokens.arbitrum?.map((t) => ({
        ...t,
        chain: chainId.arbitrum
      })) ?? []),
      ...(allTokens.optimism?.map((t) => ({
        ...t,
        chain: chainId.optimism
      })) ?? []),
      ...(allTokens.polygon?.map((t) => ({
        ...t,
        chain: chainId.polygon
      })) ?? [])
    ];

    const tokens = await Promise.all(
      tokensMapped?.map(async (token) => {
        const res = await fetch(
          token.tokenURI
          // `https://cloudflare-ipfs.com/ipfs/${process.env.NEXT_PUBLIC_CID_METADATA}/${tokenId}`
        );
        const meta: MetadataResponse = await res.json();

        const { tokenNumber } = getCountryAndTokenNumber(token.id);

        return {
          ...meta,

          tokenId: token.id,
          tokenNumber: tokenNumber.toString(),
          link: `/token/${token.chain}/${token.id}`,
          image: `https://generator.proofofresidency.xyz/token/${token.chain}/${token.id}.png`,
          chain: getChainForChainId(token.chain)?.name ?? ''
          // `https://cloudflare-ipfs.com/ipfs/${process.env.NEXT_PUBLIC_CID_CONTENT}/token/${tokenId}.png`
        };
      }) ?? []
    );

    const props: UserDetailsProps = {
      ownerId: owner,
      tokens
    };

    return {
      props,
      revalidate: 300
    };
  } catch (e) {
    console.error(e);
    return { notFound: true };
  }
};

const UserDetailsPage = (props: UserDetailsProps) => {
  // const tags = [
  //   {
  //     name: 'Count Minted',
  //     content: `${numeral(props.minted).format('0,0')}`,
  //     tooltip: 'The number of tokens which have been minted across all supported chains.'
  //   },
  //   {
  //     name: 'ISO-3166 ID',
  //     content: props.alpha3,
  //     tooltip: 'The ISO-3166 identifier for the country.'
  //   },
  //   ...[
  //     props.population !== 0
  //       ? {
  //           name: '2020 Population',
  //           content: `${numeral(props.population).format('0.0a')}`,
  //           tooltip: 'The total population count in 2020.'
  //         }
  //       : {}
  //   ],
  //   {
  //     name: 'License',
  //     link: 'https://creativecommons.org/publicdomain/zero/1.0/',
  //     content: 'CCO: No Rights Reserved'
  //   }
  // ];

  return (
    <>
      <Header />
      <Flex pt="70px" width="100%" direction="column">
        <NextSeo
          title={`${props.ownerId} | Proof of Residency`}
          // openGraph={{
          //   images: [
          //     {
          //       url: `https://proofofresidency.xyz${props.image}`,
          //       width: 1800,
          //       height: 1800,
          //       alt: props.country
          //     }
          //   ]
          // }}
        />
        <Box>
          <Flex mx="auto" position="relative" height={600}>
            {/* <Image
              priority
              objectFit="contain"
              layout="fill"
              placeholder="empty"
              src={props.imageLarge}
              alt={props.country}
            /> */}
          </Flex>
        </Box>

        <Divider />

        <Heading fontSize="5xl" mt={6} textAlign="center">
          {props.ownerId}
        </Heading>

        <Grid px={4} maxWidth={1200} width="100%" mx="auto" flexDirection="column" mt={4}>
          {props.country && (
            <Text maxWidth={600} mx="auto" fontSize="xl" textAlign="center" width="100%">
              {`Art inspired by ${props.country} and its water bodies.`}
            </Text>
          )}

          <Text maxWidth={600} mt={1} mx="auto" fontSize="md" textAlign="center" width="100%">
            Designs for every minted NFT vary.
          </Text>

          <SimpleGrid
            mx={{ base: 4, sm: 'auto' }}
            mt={8}
            mb={8}
            spacingX={10}
            spacingY={4}
            columns={{ base: 1, sm: 2 }}
          >
            {tags.map((tag) => (
              <Flex key={tag.name} direction="column">
                <Text fontWeight="bold" fontSize="lg">
                  {tag.name}
                </Text>
                <Tooltip label={tag.tooltip}>
                  {tag.link ? (
                    <Box cursor="pointer">
                      <Link href={tag.link} passHref>
                        <Tag mt={1} variant="solid" size="lg">
                          {tag.content}
                        </Tag>
                      </Link>
                    </Box>
                  ) : (
                    <Box mt={1}>
                      <Tag variant="solid" size="lg">
                        {tag.content}
                      </Tag>
                    </Box>
                  )}
                </Tooltip>
              </Flex>
            ))}
          </SimpleGrid>

          {props.tokens.length > 0 && (
            <>
              <Divider />
              <Heading textAlign="center" mt={4} fontSize="3xl">
                Minted Tokens
              </Heading>

              <SimpleGrid
                mx="auto"
                alignItems="center"
                width="100%"
                maxWidth={1200}
                mt={4}
                mb={8}
                columns={{ base: 1, md: 2, lg: 3 }}
                spacing={8}
              >
                {props.tokens.map((token, i) => (
                  <Link key={token.tokenId} href={token.link} passHref>
                    <Flex align="center" cursor="pointer" direction="column">
                      <Box>
                        <Flex mt={2} mx="auto" position="relative" width={400} height={400}>
                          <Image
                            objectFit="contain"
                            layout="fill"
                            placeholder="empty"
                            src={token.image}
                            alt={token.tokenNumber}
                          />
                        </Flex>
                      </Box>
                      <Heading mt={2} fontSize="2xl">
                        {token.chain}: #{token.tokenNumber}
                      </Heading>
                      <Box mt={2}>
                        <Tag variant="solid" size="md">
                          Owner: {token.owner.content}
                        </Tag>
                      </Box>
                    </Flex>
                  </Link>
                ))}
              </SimpleGrid>
            </>
          )}
        </Grid>
      </Flex>
      <Footer />
    </>
  );
};

export default UserDetailsPage;
